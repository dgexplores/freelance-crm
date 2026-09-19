import "server-only";
import { prisma } from "@/lib/prisma";
import { listStaleDeals } from "@/lib/ai/nudge";
import { getUserPrefs } from "@/lib/prefs";
import { withTimeout } from "@/lib/with-timeout";

/** Bound for the whole board read. Slow DB must hit error.tsx, not hang Suspense. */
export const BOARD_DATA_TIMEOUT_MS = 8000;

function boardQuery(userId: string) {
  return getUserPrefs(userId).then(async ({ staleDays }) => {
    const [deals, userData, factCount, staleDeals] = await Promise.all([
      prisma.deal.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          stage: true,
          whyInPipeline: true,
          value: true,
          wonAt: true,
          createdAt: true,
          updatedAt: true,
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              lastContact: true,
              emails: {
                select: { subject: true, fromAddr: true, receivedAt: true },
                orderBy: { receivedAt: "desc" },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, gmailSyncStartedAt: true },
      }),
      prisma.fact.count({ where: { userId } }),
      listStaleDeals(userId, staleDays),
    ]);
    return { deals, userData, factCount, staleDeals, staleDays };
  });
}

export type BoardData = {
  deals: Awaited<ReturnType<typeof boardQuery>>["deals"];
  userData: Awaited<ReturnType<typeof boardQuery>>["userData"];
  factCount: Awaited<ReturnType<typeof boardQuery>>["factCount"];
  staleDeals: Awaited<ReturnType<typeof boardQuery>>["staleDeals"];
  staleDays: Awaited<ReturnType<typeof boardQuery>>["staleDays"];
};

/** All board reads in one bounded promise. Rejects with TimeoutError on stall. */
export function loadBoardData(userId: string): Promise<BoardData> {
  return withTimeout(boardQuery(userId), { ms: BOARD_DATA_TIMEOUT_MS, label: "board-data" });
}
