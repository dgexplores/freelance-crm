import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { runPipeline } from "@/lib/pipeline";
import { isDbUp, createTestUser, cleanupUser, fakeMessage } from "./helpers";

const dbUp = await isDbUp();
const d = dbUp ? describe : describe.skip;

d("pipeline staging (Postgres)", () => {
  let userId: string;

  afterAll(async () => {
    if (userId) await cleanupUser(userId);
    await prisma.$disconnect();
  });

  d("runPipeline", () => {
    it("stages a message into contact + email + deal + facts atomically", async () => {
      const user = await createTestUser();
      userId = user.id;

      const result = await runPipeline(user.id, [fakeMessage()]);

      expect(result.errors).toEqual([]);
      expect(result.imported).toBe(1);
      expect(result.contacts).toBe(1);
      expect(result.deals).toBe(1);
      expect(result.facts).toBeGreaterThanOrEqual(2); // inbound strong + subject strong (+ suggestions)

      const contact = await prisma.contact.findFirst({ where: { userId } });
      expect(contact?.email).toBe("jane-1@prospect.test");

      const deal = await prisma.deal.findFirst({ where: { userId } });
      expect(deal?.stage).toBe("INBOX");
      expect(deal?.whyInPipeline).toContain('subject "Website redesign quote"');

      const emailRow = await prisma.email.findFirst({ where: { userId } });
      expect(emailRow?.contactId).toBe(contact?.id);

      const facts = await prisma.fact.findMany({ where: { userId } });
      expect(facts.some((f) => f.strength === "strong")).toBe(true);
    });

    it("dedupes by gmailId on re-import", async () => {
      const msg = fakeMessage();
      await runPipeline(userId, [msg]);
      const second = await runPipeline(userId, [msg]);

      expect(second.imported).toBe(0);
      expect(second.skipped).toBe(1);
      expect(second.contacts).toBe(0);
      expect(second.deals).toBe(0);
    });

    it("keeps evidence fresh only while the deal is INBOX", async () => {
      // Same sender as the first staged message → same contact, no new deal.
      const res = await runPipeline(userId, [
        fakeMessage({
          subject: "Second email on same thread",
          fromAddr: '"Jane Doe" <jane-1@prospect.test>',
        }),
      ]);
      expect(res.deals).toBe(0);
      expect(res.imported).toBe(1);

      const deal = await prisma.deal.findFirst({ where: { userId } });
      expect(deal?.whyInPipeline).toContain("Latest Inbound email");
    });

    it("skips messages with unparseable senders and reports them", async () => {
      const res = await runPipeline(userId, [fakeMessage({ fromAddr: "not-an-email" })]);
      expect(res.imported).toBe(0);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toContain("no parseable sender");
    });

    it("isolates users: another user's import does not touch this data", async () => {
      const other = await createTestUser();
      try {
        const before = await prisma.email.count({ where: { userId } });
        await runPipeline(other.id, [fakeMessage()]);
        const after = await prisma.email.count({ where: { userId } });
        expect(after).toBe(before);
      } finally {
        await cleanupUser(other.id);
      }
    });
  });
});
