import { prisma } from "@/lib/prisma";

/** True when a PostgreSQL is reachable via DATABASE_URL. */
export async function isDbUp(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

let counter = 0;

export function uniqEmail(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${counter}-${rand}@test.local`;
}

export async function createTestUser(): Promise<{ id: string }> {
  const user = await prisma.user.create({
    data: { email: uniqEmail("user") },
    select: { id: true },
  });
  return user;
}

/**
 * Delete every row belonging to the test user, children first
 * (relations do not cascade outside auth tables).
 */
export async function cleanupUser(userId: string): Promise<void> {
  await prisma.fact.deleteMany({ where: { userId } });
  await prisma.email.deleteMany({ where: { userId } });

  const deals = await prisma.deal.findMany({
    where: { userId },
    select: { id: true },
  });
  if (deals.length > 0) {
    const ids = deals.map((d) => d.id);
    await prisma.task.deleteMany({ where: { dealId: { in: ids } } });
    await prisma.deal.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.contact.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}

let msgCounter = 0;

/** Deterministic-enough ImportedMessage for pipeline tests. */
export function fakeMessage(
  overrides: Partial<{
    gmailId: string;
    threadId: string;
    subject: string;
    fromAddr: string;
    body: string;
    snippet: string;
    receivedAt: Date;
  }> = {},
) {
  msgCounter += 1;
  return {
    gmailId: overrides.gmailId ?? `msg-${Date.now()}-${msgCounter}`,
    threadId: overrides.threadId ?? `thread-${msgCounter}`,
    subject: overrides.subject ?? "Website redesign quote",
    fromAddr: overrides.fromAddr ?? `"Jane Doe" <jane-${msgCounter}@prospect.test>`,
    receivedAt: overrides.receivedAt ?? new Date(),
    snippet: overrides.snippet ?? "We need a rebuild of our marketing site.",
    body: overrides.body ?? "Hi, we are looking for a freelancer to rebuild our website. Budget around $10k.",
  };
}
