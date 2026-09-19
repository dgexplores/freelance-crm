import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import type { Deal, DealStage } from "@prisma/client";

export const NUDGE_STAGES: DealStage[] = ["INBOX", "QUALIFIED"];
export const PROPOSAL_STAGES: DealStage[] = ["PROPOSAL"];

const DAY_MS = 24 * 60 * 60 * 1000;

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
  stages: DealStage[] = NUDGE_STAGES,
): boolean {
  if (!stages.includes(ctx.deal.stage)) return false;
  const cutoff = Date.now() - days * DAY_MS;
  return ctx.lastActivityAt.getTime() < cutoff;
}

export function idleDays(ctx: DealContext): number {
  return Math.max(0, Math.floor((Date.now() - ctx.lastActivityAt.getTime()) / DAY_MS));
}

export function lastActivity(
  deal: Deal,
  lastContact: Date | null,
  emails: Array<{ receivedAt: Date }>,
): Date {
  const signals: number[] = [];
  if (lastContact) signals.push(lastContact.getTime());
  if (emails[0]) signals.push(emails[0].receivedAt.getTime());
  const floor = deal.createdAt.getTime();
  const latest = signals.length ? Math.max(...signals) : floor;
  return new Date(Math.max(latest, floor));
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
      const body = truncate(e.body.replace(/\s+/g, " "), 500).replace(
        /<\/untrusted-email>/gi,
        "[untrusted-email]",
      );
      const subject = e.subject.replace(/<\/untrusted-email>/gi, "[untrusted-email]");
      return `<untrusted-email id=${i + 1} direction=${e.direction.toUpperCase()} date=${when}>\nsubject: ${subject}\n${body}\n</untrusted-email>`;
    })
    .join("\n\n");
}
