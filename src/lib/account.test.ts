import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";
import { prisma } from "@/lib/prisma";
import { collectUserData, deleteUserData } from "@/lib/account";

type PrismaMock = {
  user: { findUnique: Mock; delete: Mock };
  deal: { findMany: Mock; deleteMany: Mock };
  contact: { findMany: Mock; deleteMany: Mock };
  email: { findMany: Mock; deleteMany: Mock };
  fact: { findMany: Mock; deleteMany: Mock };
  task: { findMany: Mock; deleteMany: Mock };
  session: { deleteMany: Mock };
  account: { findFirst: Mock; deleteMany: Mock };
  $transaction: Mock;
};

const p = prisma as unknown as PrismaMock;

const firstCall = (m: Mock): number => m.mock.invocationCallOrder[0] ?? 0;

beforeEach(() => {
  vi.clearAllMocks();
  // Re-install the pass-through transaction runner, which the shared setup
  // provides but clearAllMocks can leave in an indeterminate state.
  p.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(p),
  );
});

describe("collectUserData", () => {
  beforeEach(() => {
    p.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "dg@example.com",
      name: "DG",
      rateCard: "# Rates",
      gmailSyncStartedAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2025-12-01T00:00:00Z"),
    });
    p.contact.findMany.mockResolvedValue([
      {
        id: "c1",
        email: "dana@acme.test",
        name: "Dana",
        company: null,
        linkedinUrl: null,
        source: "inbound",
        lastContact: new Date("2026-09-01T00:00:00Z"),
        userId: "user_1",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);
    p.deal.findMany.mockResolvedValue([
      {
        id: "d1",
        title: "Acme retainer",
        stage: "INBOX",
        value: null,
        wonAt: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        updatedAt: new Date("2026-01-03T00:00:00Z"),
      },
    ]);
    p.email.findMany.mockResolvedValue([
      {
        id: "e1",
        subject: "Hello",
        body: "Hi",
        receivedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);
    p.fact.findMany.mockResolvedValue([
      { id: "f1", claim: "Budget is 10k", createdAt: new Date("2026-01-02T00:00:00Z") },
    ]);
    p.task.findMany.mockResolvedValue([
      {
        id: "t1",
        kind: "follow_up",
        dueAt: new Date("2026-01-05T00:00:00Z"),
        doneAt: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);
  });

  it("includes every collection the account owns", async () => {
    const data = await collectUserData("user_1");

    expect(data.account?.email).toBe("dg@example.com");
    expect(data.contacts).toHaveLength(1);
    expect(data.deals).toHaveLength(1);
    expect(data.emails).toHaveLength(1);
    expect(data.facts).toHaveLength(1);
    expect(data.tasks).toHaveLength(1);
    expect(data.meta.schemaVersion).toBe(1);
  });

  it("serialises dates to ISO strings", async () => {
    const data = await collectUserData("user_1");
    expect(data.account?.gmailSyncStartedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(data.account?.createdAt).toBe("2025-12-01T00:00:00.000Z");
  });

  it("never reads OAuth credential rows", async () => {
    await collectUserData("user_1");
    expect(p.account.findFirst).not.toHaveBeenCalled();
  });

  it("does not leak token fields into the payload", async () => {
    const serialised = JSON.stringify(await collectUserData("user_1"));
    expect(serialised).not.toContain("accessToken");
    expect(serialised).not.toContain("refreshToken");
    expect(serialised).not.toContain("idToken");
  });

  it("scopes tasks through the deal, since Task has no userId", async () => {
    await collectUserData("user_1");
    expect(p.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deal: { userId: "user_1" } } }),
    );
  });
});

describe("deleteUserData", () => {
  beforeEach(() => {
    for (const model of [
      p.task,
      p.fact,
      p.email,
      p.deal,
      p.contact,
      p.session,
      p.account,
    ]) {
      model.deleteMany.mockResolvedValue({ count: 1 });
    }
    p.user.delete.mockResolvedValue({ id: "user_1" });
  });

  it("runs inside a transaction", async () => {
    await deleteUserData("user_1");
    expect(p.$transaction).toHaveBeenCalledTimes(1);
  });

  it("deletes children before the parents they point at", async () => {
    await deleteUserData("user_1");

    // Task -> Deal, and Deal/Fact/Email -> Contact. Deleting a parent first
    // would trip a foreign-key constraint, since none of these relations
    // cascade from User.
    expect(firstCall(p.task.deleteMany)).toBeLessThan(firstCall(p.deal.deleteMany));
    expect(firstCall(p.deal.deleteMany)).toBeLessThan(firstCall(p.contact.deleteMany));
    expect(firstCall(p.email.deleteMany)).toBeLessThan(firstCall(p.contact.deleteMany));
    expect(firstCall(p.fact.deleteMany)).toBeLessThan(firstCall(p.contact.deleteMany));
  });

  it("deletes the user last", async () => {
    await deleteUserData("user_1");
    const userCall = firstCall(p.user.delete);

    for (const model of [
      p.task,
      p.fact,
      p.email,
      p.deal,
      p.contact,
      p.session,
      p.account,
    ]) {
      expect(firstCall(model.deleteMany)).toBeLessThan(userCall);
    }
  });

  it("clears sessions so the caller is signed out immediately", async () => {
    await deleteUserData("user_1");
    expect(p.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
  });

  it("scopes every delete to the given user", async () => {
    await deleteUserData("user_1");

    expect(p.deal.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(p.contact.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(p.email.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(p.fact.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(p.task.deleteMany).toHaveBeenCalledWith({ where: { deal: { userId: "user_1" } } });
    expect(p.user.delete).toHaveBeenCalledWith({ where: { id: "user_1" } });
  });
});
