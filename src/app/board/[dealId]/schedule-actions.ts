"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/session";
import { scheduleFollowUpsForUser, type SchedulerResult } from "@/lib/scheduler";
import { DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";

export type { SchedulerResult };

/**
 * Schedule follow-up nudges for the signed-in user's stale deals.
 * Session-scoped wrapper around the shared scheduler in @/lib/scheduler.
 */
export async function scheduleStaleFollowUpsAction(
  days: number = DEFAULT_STALE_DAYS,
): Promise<SchedulerResult & { ok: boolean; message: string }> {
  const user = await getUser();
  if (!user) {
    return { ok: false, message: "Not authenticated.", scheduled: 0, errors: [] };
  }

  try {
    const result = await scheduleFollowUpsForUser(user.id, days);
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
