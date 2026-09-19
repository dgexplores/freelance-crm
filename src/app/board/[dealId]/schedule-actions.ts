"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";
import { scheduleFollowUpsForUser, type SchedulerResult } from "@/lib/scheduler";

export type { SchedulerResult };

/**
 * Schedule follow-up nudges for the signed-in user's stale deals.
 * Session-scoped wrapper around the shared scheduler in @/lib/scheduler.
 * Defaults to the user's own stale-day threshold when `days` is omitted.
 */
export async function scheduleStaleFollowUpsAction(
  days?: number,
): Promise<SchedulerResult & { ok: boolean; message: string }> {
  const user = await getUser();
  if (!user) {
    return { ok: false, message: "Not authenticated.", scheduled: 0, errors: [] };
  }

  try {
    let floored: number;
    if (days === undefined) {
      floored = (await getUserPrefs(user.id)).staleDays;
    } else {
      floored = Math.floor(days);
    }
    if (!Number.isFinite(days) || floored < 1 || floored > 30) {
      const message = "Invalid days parameter. Must be an integer between 1 and 30.";
      return { ok: false, message, scheduled: 0, errors: [message] };
    }
    const result = await scheduleFollowUpsForUser(user.id, floored);
    revalidatePath("/board");
    return {
      ok: true,
      message: `Scheduled ${result.scheduled} follow-up${result.scheduled !== 1 ? "s" : ""}.`,
      ...result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scheduling failed.";
    return { ok: false, message, scheduled: 0, errors: [message] };
  }
}
