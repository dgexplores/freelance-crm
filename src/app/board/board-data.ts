import "server-only";
import { prisma } from "@/lib/prisma";
import { listStaleDeals } from "@/lib/ai/nudge";
import { withTimeout } from "@/lib/with-timeout";

/** Bound for the whole board read. Slow DB must hit error.tsx, not hang Suspense. */
export const BOARD_DATA_TIMEOUT_MS = 8000;

function boardQuery(userId: string) {
  return Promise.all([
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
    listStaleDeals(userId, 5),
  ]);
}

export type BoardData = {
  deals: Awaited<ReturnType<typeof boardQuery>>[0];
  userData: Awaited<ReturnType<typeof boardQuery>>[1];
  factCount: Awaited<ReturnType<typeof boardQuery>>[2];
  staleDeals: Awaited<ReturnType<typeof boardQuery>>[3];
};

/** All board reads in one bounded promise. Rejects with TimeoutError on stall. */
export function loadBoardData(userId: string): Promise<BoardData> {
  return withTimeout(
    boardQuery(userId).then(([deals, userData, factCount, staleDeals]) => ({
      deals,
      userData,
      factCount,
      staleDeals,
    })),
    { ms: BOARD_DATA_TIMEOUT_MS, label: "board-data" },
  );
}
