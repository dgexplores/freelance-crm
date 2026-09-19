import { describe, it, expect, vi, beforeEach } from "vitest";
import { TimeoutError } from "@/lib/with-timeout";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    deal: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    fact: { count: vi.fn() },
  },
}));

vi.mock("@/lib/ai/nudge", () => ({
  listStaleDeals: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { listStaleDeals } from "@/lib/ai/nudge";
import { loadBoardData } from "@/app/board/board-data";

const hanging = () => new Promise<never>(() => {});

beforeEach(() => {
  vi.mocked(prisma.deal.findMany).mockReturnValue(hanging() as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.fact.count).mockResolvedValue(0);
  vi.mocked(listStaleDeals).mockResolvedValue([]);
});

describe("loadBoardData", () => {
  it("rejects with TimeoutError instead of hanging when the DB stalls", async () => {
    await expect(loadBoardData("user-1")).rejects.toBeInstanceOf(TimeoutError);
  }, 15000);

  it("resolves board data when the DB answers in time", async () => {
    vi.mocked(prisma.deal.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "dev@local.test",
      name: "Dev User",
      gmailSyncStartedAt: null,
    } as never);
    const data = await loadBoardData("user-1");
    expect(data.deals).toEqual([]);
    expect(data.factCount).toBe(0);
  });
});
