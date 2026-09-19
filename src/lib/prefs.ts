import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
import { logger } from "@/lib/logger";

export type UserPrefs = { staleDays: number; autoFollowUp: boolean };

const FALLBACK: UserPrefs = { staleDays: DEFAULT_STALE_DAYS, autoFollowUp: true };

/**
 * User pipeline preferences with graceful fallback.
 * Returns defaults when the columns haven't been pushed yet
 * (prod schema drift) — logs once so the push isn't forgotten.
 */
export async function getUserPrefs(userId: string): Promise<UserPrefs> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { staleDays: true, autoFollowUp: true },
    });
    if (!u) return FALLBACK;
    const staleDays =
      Number.isInteger(u.staleDays) && u.staleDays >= 1 && u.staleDays <= 30
        ? u.staleDays
        : DEFAULT_STALE_DAYS;
    return { staleDays, autoFollowUp: u.autoFollowUp ?? true };
  } catch (err) {
    logger.warn("User prefs unavailable, using defaults — run `npm run db:push`.", {
      error: err instanceof Error ? err.message : String(err),
    });
    return FALLBACK;
  }
}
