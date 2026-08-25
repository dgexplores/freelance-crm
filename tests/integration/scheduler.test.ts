import { describe, it, expect, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// The scheduler generates nudges via Gemini — replace the whole module so no
// network calls happen. Everything else runs against the real database.
vi.mock("@/lib/ai/gemini", () => {
  class AiUnavailableError extends Error {
    constructor(message = "GEMINI_API_KEY is not set") {
      super(message);
    }
  }
  class GeminiApiError extends Error {}
  return {
    AiUnavailableError,
    GeminiApiError,
    DEFAULT_GEMINI_MODEL: "test-model",
    geminiConfigured: () => true,
    generateText: vi.fn(async () => "Subject: hi\nDraft:\nChecking in!"),
    generateTextWithRetry: vi.fn(async () => "Subject: hi\nDraft:\nChecking in!"),
    openGeminiStream: vi.fn(),
  };
});

import { scheduleFollowUpsForUser } from "@/lib/scheduler";
import { listStaleDeals } from "@/lib/ai/nudge";
import { runPipeline } from "@/lib/pipeline";
import { createTestUser, cleanupUser, fakeMessage, isDbUp } from "./helpers";

const dbUp = await isDbUp();
const d = dbUp ? describe : describe.skip;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

d("stale follow-up scheduler (Postgres)", () => {
  let userId: string;

  afterAll(async () => {
    if (userId) await cleanupUser(userId);
    await prisma.$disconnect();
  });

  it("schedules exactly one task per stale deal and never duplicates", async () => {
    const user = await createTestUser();
    userId = user.id;

    // Stale deal: contact last contacted 10 days ago.
    await runPipeline(user.id, [
      fakeMessage({ receivedAt: daysAgo(10), subject: "Old inquiry" }),
    ]);
    await prisma.contact.updateMany({
      where: { userId },
      data: { lastContact: daysAgo(10) },
    });
    // Backdate creation too — staleness floors at deal.createdAt so a
    // just-created deal can never be instantly stale.
    await prisma.deal.updateMany({
      where: { userId },
      data: { createdAt: daysAgo(12) },
    });

    const staleBefore = await listStaleDeals(userId, 5);
    expect(staleBefore).toHaveLength(1);
    expect(staleBefore[0]?.idleDays).toBeGreaterThanOrEqual(10);

    const firstRun = await scheduleFollowUpsForUser(user.id, 5);
    expect(firstRun.errors).toEqual([]);
    expect(firstRun.scheduled).toBe(1);

    const secondRun = await scheduleFollowUpsForUser(user.id, 5);
    expect(secondRun.scheduled).toBe(0); // already pending → skipped

    const tasks = await prisma.task.findMany({
      where: { kind: "follow_up", done: false },
      include: { deal: true },
    });
    const ownTasks = tasks.filter((t) => t.deal.userId === user.id);
    expect(ownTasks).toHaveLength(1);
    expect(ownTasks[0]?.reason).toContain("Auto-scheduled");
  });

  it("ignores fresh deals entirely", async () => {
    const user = await createTestUser();
    try {
      await runPipeline(user.id, [fakeMessage({ subject: "Fresh lead" })]); // received now

      const result = await scheduleFollowUpsForUser(user.id, 5);
      expect(result.scheduled).toBe(0);

      const stale = await listStaleDeals(user.id, 5);
      expect(stale).toHaveLength(0);
    } finally {
      await cleanupUser(user.id);
    }
  });
});
