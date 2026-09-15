import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import type { Deal } from "@prisma/client";
import { NUDGE_STAGES, idleDaysSince, isIdleFor, lastActivityAt } from "@/lib/staleness";

// Re-exported so existing importers (nudge.ts, scheduler.ts) keep working while
// the definitions live in the Prisma-free `@/lib/staleness` module.
export { NUDGE_STAGES };

export interface DealContext {
  deal: Deal;
  contact: {
    name: string | null;
    email: string;
    company: string | null;
    linkedinUrl: string | null;
    source: string | null;
    lastContact: Date | null;
  };
  user: {
    name: string | null;
    email: string;
    rateCard: string | null;
  };
  emails: Array<{
    subject: string;
    body: string;
    direction: string;
    receivedAt: Date;
  }>;
  lastActivityAt: Date;
}

/** Thrown when a deal does not exist or is not owned by the requesting user. */
export class DealNotFoundError extends NotFoundError {
  constructor() {
    super("Deal not found");
    this.name = "DealNotFoundError";
  }
}

/** Load deal + contact + user + the contact's recent email history, strictly scoped to `userId`. */
export async function loadDealContext(userId: string, dealId: string): Promise<DealContext> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, userId },
    include: { contact: true, user: true },
  });
  if (!deal) throw new DealNotFoundError();

  const emails = await prisma.email.findMany({
    where: { contactId: deal.contactId, userId: deal.userId },
    orderBy: { receivedAt: "desc" },
    take: 20,
    select: { subject: true, body: true, direction: true, receivedAt: true },
  });

  const lastActivityAt = lastActivity(deal, deal.contact.lastContact, emails);

  return {
    deal,
    contact: {
      name: deal.contact.name,
      email: deal.contact.email,
      company: deal.contact.company,
      linkedinUrl: deal.contact.linkedinUrl,
      source: deal.contact.source,
      lastContact: deal.contact.lastContact,
    },
    user: {
      name: deal.user.name,
      email: deal.user.email,
      rateCard: deal.user.rateCard,
    },
    emails: emails.map((e) => ({
      subject: e.subject,
      body: e.body,
      direction: e.direction,
      receivedAt: e.receivedAt,
    })),
    lastActivityAt,
  };
}

/**
 * A deal is stale when it is still in INBOX/QUALIFIED and nothing has
 * happened for at least `days` days. "Activity" = the contact's lastContact
 * or the newest email on the thread; falls back to the deal's creation date.
 * Deal metadata edits (updatedAt) do NOT reset the stale timer.
 */
export function isStaleDeal(
  ctx: DealContext,
  days: number,
  stages: readonly string[] = NUDGE_STAGES,
): boolean {
  if (!stages.includes(ctx.deal.stage)) return false;
  // Uses the already-computed ctx.lastActivityAt rather than recomputing it.
  return isIdleFor(ctx.lastActivityAt, days);
}

export function idleDays(ctx: DealContext): number {
  return idleDaysSince(ctx.lastActivityAt);
}

export function lastActivity(
  deal: Deal,
  lastContact: Date | null,
  emails: Array<{ receivedAt: Date }>,
): Date {
  return lastActivityAt({
    createdAt: deal.createdAt,
    lastContact,
    latestEmailAt: emails[0]?.receivedAt ?? null,
  });
}

export function truncate(text: string | null | undefined, max = 1200): string {
  if (!text) return "";
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function formatEmails(
  emails: DealContext["emails"],
  max = 6,
): string {
  return emails
    .slice(0, max)
    .map((e, i) => {
      const when = e.receivedAt.toISOString().slice(0, 10);
      const body = truncate(e.body.replace(/\s+/g, " "), 500);
      return `[${i + 1}] ${e.direction.toUpperCase()} | ${when} | subject: ${e.subject}\n${body}`;
    })
    .join("\n\n");
}
