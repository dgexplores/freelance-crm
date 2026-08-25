import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { runPipeline } from "@/lib/pipeline";
import { loadDealContext, DealNotFoundError, isStaleDeal } from "@/lib/ai/context";
import { createTestUser, cleanupUser, fakeMessage, isDbUp } from "./helpers";

const dbUp = await isDbUp();
const d = dbUp ? describe : describe.skip;

d("deal context scoping (IDOR regression)", () => {
  let ownerUserId: string;

  afterAll(async () => {
    if (ownerUserId) await cleanupUser(ownerUserId);
    await prisma.$disconnect();
  });

  it("refuses to load a deal for a non-owner user", async () => {
    const owner = await createTestUser();
    ownerUserId = owner.id;
    await runPipeline(owner.id, [fakeMessage()]);

    const deal = await prisma.deal.findFirst({ where: { userId: owner.id } });
    expect(deal).not.toBeNull();

    const attacker = await createTestUser();
    try {
      await expect(loadDealContext(attacker.id, deal!.id)).rejects.toBeInstanceOf(
        DealNotFoundError,
      );
    } finally {
      await cleanupUser(attacker.id);
    }
  });

  it("loads full context for the rightful owner", async () => {
    const ctx = await loadDealContext(
      (await prisma.deal.findFirst({ where: { userId: ownerUserId } }))!.userId,
      (await prisma.deal.findFirst({ where: { userId: ownerUserId } }))!.id,
    );
    expect(ctx.emails.length).toBeGreaterThan(0);
    expect(ctx.user.rateCard).toBeNull();
    expect(isStaleDeal(ctx, 5)).toBe(false); // just imported → fresh
  });

  it("404s for a nonexistent deal id", async () => {
    await expect(loadDealContext("some-user", "nonexistent-id")).rejects.toBeInstanceOf(
      DealNotFoundError,
    );
  });
});
