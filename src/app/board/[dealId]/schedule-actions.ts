"use server";

import { prisma } from "@/lib/prisma";
import { listStaleDeals, generateFollowUpNudge, DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
import { getUser } from "@/lib/session";

export type SchedulerResult = {
  ok: boolean;
  message: string;
  scheduled: number;
  errors: string[];
};

/**
 * Schedule follow-up nudges for all stale deals.
 * Called periodically (e.g., via cron) or manually from the UI.
 */
export async function scheduleStaleFollowUpsAction(days: number = DEFAULT_STALE_DAYS): Promise<SchedulerResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated.", scheduled: 0, errors: [] };

  const staleDeals = await listStaleDeals(days);

  // Filter to only this user's deals
  const deals = await prisma.deal.findMany({
    where: { userId: user.id, stage: { in: ["INBOX", "QUALIFIED"] } },
  });
  const userDealIds = new Set(deals.map((d) => d.id));
  const relevantStale = staleDeals.filter((d) => userDealIds.has(d.dealId));

  let scheduled = 0;
  const errors: string[] = [];

  for (const stale of relevantStale) {
    // Check if there's already a pending follow-up task for this deal
    const existing = await prisma.task.findFirst({
      where: { dealId: stale.dealId, kind: "follow_up", done: false },
    });
    if (existing) continue;

    try {
      const nudge = await generateFollowUpNudge(stale.dealId, days);
      // Schedule for tomorrow morning
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 1);
      dueAt.setHours(9, 0, 0, 0);

      await prisma.task.create({
        data: {
          dealId: stale.dealId,
          kind: "follow_up",
          dueAt,
          reason: `Auto-scheduled: deal idle ${stale.idleDays}d. ${nudge.draft.slice(0, 200)}...`,
        },
      });
      scheduled++;
    } catch (err) {
      errors.push(`${stale.title}: ${err instanceof Error ? err.message : "Failed"}`);
    }
  }

  return {
    ok: true,
    message: `Scheduled ${scheduled} follow-up${scheduled !== 1 ? "s" : ""}.`,
    scheduled,
    errors,
  };
}