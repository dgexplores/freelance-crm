import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listStaleDeals, generateFollowUpNudge, DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
import { checkAiQuota, recordAiUsage } from "@/lib/billing";
import { getUserPrefs } from "@/lib/prefs";
import { logger } from "@/lib/logger";

export type SchedulerResult = {
  scheduled: number;
  errors: string[];
};

export type AllUsersSchedulerResult = SchedulerResult & {
  usersScanned: number;
};

/**
 * Schedule follow-up tasks for one user's stale deals.
 * No session required — callers enforce their own authorization
 * (server action checks the session; the cron route checks CRON_SECRET).
 */
export async function scheduleFollowUpsForUser(
  userId: string,
  days: number = DEFAULT_STALE_DAYS,
): Promise<SchedulerResult> {
  const staleDeals = await listStaleDeals(userId, days);

  let scheduled = 0;
  const errors: string[] = [];

  for (const stale of staleDeals) {
    // Skip deals that already have a pending follow-up task.
    const existing = await prisma.task.findFirst({
      where: { dealId: stale.dealId, kind: "follow_up", done: false },
    });
    if (existing) continue;

    try {
      await checkAiQuota(userId);
      const nudge = await generateFollowUpNudge(userId, stale.dealId, days);
      await recordAiUsage(userId);
      try {
        await prisma.task.create({
          data: {
            dealId: stale.dealId,
            kind: "follow_up",
            dueAt: nextMorningAt9(),
            reason: `Auto-scheduled: deal idle ${stale.idleDays}d. ${nudge.draft.slice(0, 200)}...`,
          },
        });
      } catch (createErr) {
        // Harmless race guard: with @@index (not unique) on Task this
        // never fires, but keep it so concurrent scheduler runs stay safe
        // if a unique constraint is ever reintroduced for pending tasks.
        if (
          createErr instanceof Prisma.PrismaClientKnownRequestError &&
          createErr.code === "P2002"
        ) {
          continue;
        }
        throw createErr;
      }
      scheduled += 1;
    } catch (err) {
      errors.push(`${stale.title}: ${err instanceof Error ? err.message : "Failed"}`);
    }
  }

  return { scheduled, errors };
}

/**
 * Run the scheduler across every user with pipeline deals.
 * Used by the daily cron endpoint, which has no session context.
 * Each user runs on their own stale-day threshold; opted-out users skip.
 */
export async function scheduleFollowUpsAllUsers(): Promise<AllUsersSchedulerResult> {
  const rows = await prisma.deal.findMany({
    where: { stage: { in: ["INBOX", "QUALIFIED"] } },
    select: { userId: true },
    distinct: ["userId"],
  });

  let scheduled = 0;
  const errors: string[] = [];

  for (const { userId } of rows) {
    try {
      const prefs = await getUserPrefs(userId);
      if (!prefs.autoFollowUp) continue;
      const result = await scheduleFollowUpsForUser(userId, prefs.staleDays);
      scheduled += result.scheduled;
      errors.push(...result.errors.map((e) => `[user ${userId}] ${e}`));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`[user ${userId}] ${message}`);
      logger.error("Stale follow-up scheduling failed for user", { userId, error: message });
    }
  }

  return { scheduled, errors, usersScanned: rows.length };
}

function nextMorningAt9(): Date {
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 1);
  dueAt.setHours(9, 0, 0, 0);
  return dueAt;
}
