import "server-only";
import { prisma } from "@/lib/prisma";
import {
  fetchNewMessages,
  getImportContext,
  recordForwardOnlyBoundary,
  type ImportedMessage,
  type ImportResult,
} from "@/lib/gmail";
import { logger } from "@/lib/logger";

export type PipelineResult = {
  imported: number;
  skipped: number;
  contacts: number;
  deals: number;
  facts: number;
  errors: string[];
};

export type ParsedSender = {
  email: string | null;
  name: string | null;
};

/**
 * Parse a `From` header like `"Jane Doe" <jane@example.com>`
 * or `jane@example.com`. Returns the address (lowercased) and display name.
 */
export function parseFrom(header: string): ParsedSender {
  if (!header) return { email: null, name: null };
  const angleMatch = header.match(/^"?([^"<]*)"?\s*<([^>]+)>/);
  if (angleMatch && angleMatch[1] !== undefined && angleMatch[2] !== undefined) {
    return {
      name: angleMatch[1].trim() || null,
      email: angleMatch[2].trim().toLowerCase(),
    };
  }
  const just = header.trim().toLowerCase();
  if (just.includes("@")) return { email: just, name: null };
  return { email: null, name: null };
}

export function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
}

function evidenceFor(msg: ImportedMessage): string {
  return `Inbound email from ${truncate(msg.fromAddr, 120)} on ${msg.receivedAt.toISOString()} — subject "${truncate(msg.subject, 100)}".`;
}

function makeDealTitle(msg: ImportedMessage, senderName: string | null): string {
  if (msg.subject && msg.subject.trim()) return msg.subject.trim().slice(0, 140);
  return senderName ? `Inbound: ${senderName}` : `Inbound: ${msg.fromAddr}`;
}

/**
 * Keyword heuristics -> suggestion-strength facts. Claims are literal
 * statements about the email text; they never assert intent, budget, or
 * readiness. No AI.
 */
function buildFacts(
  msg: ImportedMessage,
  contactId: string,
  userId: string,
): { claim: string; source: string; strength: string; applied: boolean; contactId: string; userId: string }[] {
  const facts: {
    claim: string;
    source: string;
    strength: string;
    applied: boolean;
    contactId: string;
    userId: string;
  }[] = [];

  const subject = msg.subject.trim();

  facts.push({
    claim: `Inbound email received from ${truncate(msg.fromAddr, 120)} on ${msg.receivedAt.toISOString()}.`,
    source: "email",
    strength: "strong",
    applied: true,
    contactId,
    userId,
  });

  if (subject) {
    facts.push({
      claim: `Email subject line reads: "${truncate(subject, 120)}".`,
      source: "email",
      strength: "strong",
      applied: true,
      contactId,
      userId,
    });
  }

  const text = `${subject}\n${msg.snippet}\n${msg.body}`;
  const haystack = text.toLowerCase();

  const budgetPattern =
    /\b(budget|rate|cost|costs|pricing|price|quote|quotation|invoice|retainer|hourly|per hour)\b|\$\s?\d|\d+\s?(usd|eur|k\b)/i;
  if (budgetPattern.test(haystack)) {
    facts.push({
      claim: "Email text contains budget/rate/cost terms (keyword match — not a confirmed budget).",
      source: "email",
      strength: "suggestion",
      applied: true,
      contactId,
      userId,
    });
  }

  const projectPattern =
    /\b(project|website|web site|app|application|logo|design|develop|build|rebuild|redesign|landing page|landing-page|mvp|scope|freelance|contract|client)\b/i;
  if (projectPattern.test(haystack)) {
    facts.push({
      claim: "Email text mentions potential project/scope terms (keyword match — intent not confirmed).",
      source: "email",
      strength: "suggestion",
      applied: true,
      contactId,
      userId,
    });
  }

  const urgencyPattern =
    /\b(deadline|urgent|asap|immediately|quickly|soon|short notice|by (today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|end of (the )?day|this week|next week))\b/i;
  if (urgencyPattern.test(haystack)) {
    facts.push({
      claim: "Email text contains urgency/deadline terms (keyword match).",
      source: "email",
      strength: "suggestion",
      applied: true,
      contactId,
      userId,
    });
  }

  return facts;
}

export type BoundaryDecision =
  | { advance: false; reason: "errors" | "no-messages" }
  | { advance: true; to: Date; reason: "complete" | "truncated" };

/**
 * Decide where the forward-only boundary may move after an import run.
 *
 * Extracted from `importGmail` so the rule is directly testable — this is the
 * logic that used to skip mail silently, so it should not be buried inside an
 * async function that needs a live Gmail account to exercise.
 *
 * Rules, in priority order:
 *  - any per-message error  → do not advance, so the whole window is retried
 *  - no messages fetched    → do not advance (never jump to `now`: mail that
 *                             exists but was not returned, e.g. during Gmail
 *                             indexing lag, would be skipped forever)
 *  - truncated fetch        → advance only to the OLDEST message seen, because
 *                             everything below it was never fetched
 *  - otherwise              → advance to the NEWEST message seen, never `now`,
 *                             so mail arriving mid-import is picked up next run
 */
export function decideBoundaryAdvance(
  messages: ImportedMessage[],
  truncated: boolean,
  errorCount: number,
): BoundaryDecision {
  if (errorCount > 0) return { advance: false, reason: "errors" };

  const first = messages[0];
  if (!first) return { advance: false, reason: "no-messages" };

  if (truncated) {
    let oldest = first.receivedAt;
    for (const m of messages) if (m.receivedAt < oldest) oldest = m.receivedAt;
    return { advance: true, to: oldest, reason: "truncated" };
  }

  let newest = first.receivedAt;
  for (const m of messages) if (m.receivedAt > newest) newest = m.receivedAt;
  return { advance: true, to: newest, reason: "complete" };
}

/**
 * Orchestrate a forward-only import run:
 *  1. resolve the forward-only boundary (recorded on first successful run)
 *  2. fetch only messages newer than the boundary (gmail.readonly)
 *  3. stage them into contacts/deals/facts (each message atomically)
 *  4. persist the boundary only after a successful run, and never past a
 *     message we did not fetch (no silent mail loss; overlap is safe via dedupe)
 */
export async function importGmail(
  userId: string,
): Promise<ImportResult & PipelineResult> {
  const ctx = await getImportContext(userId);

  logger.info("Starting Gmail import", { userId, firstRun: ctx.firstRun, sinceMs: ctx.sinceMs });

  const { messages, truncated } = await fetchNewMessages(userId, ctx.sinceMs);

  logger.info("Fetched messages from Gmail", {
    userId,
    count: messages.length,
    truncated,
  });

  const pipeline = await runPipeline(userId, messages);

  const boundary = await prisma.user.findUnique({
    where: { id: userId },
    select: { gmailSyncStartedAt: true },
  });

  const decision = decideBoundaryAdvance(messages, truncated, pipeline.errors.length);

  if (decision.advance) {
    await recordForwardOnlyBoundary(userId, decision.to);
  }

  if (decision.reason === "errors") {
    // Partial failure: the boundary stays put so the window is retried.
    logger.warn("Gmail import completed with errors — boundary not advanced", {
      userId,
      ...pipeline,
    });
  } else if (decision.reason === "no-messages") {
    logger.info("Gmail import found no new messages", { userId });
  } else if (decision.reason === "truncated") {
    // More mail existed than one run could fetch. The boundary moved only to the
    // oldest message seen, so it never passed an unfetched message; the next run
    // re-fetches (and dedupes) the overlap. Mail below this window is skipped by
    // design — forward-only — and the caller tells the user instead of hiding it.
    logger.warn("Gmail import was truncated by the fetch limit", {
      userId,
      fetched: messages.length,
      advancedTo: decision.to.toISOString(),
      ...pipeline,
    });
  } else {
    logger.info("Gmail import completed successfully", { userId, ...pipeline });
  }

  return {
    boundary: boundary?.gmailSyncStartedAt ?? null,
    firstRun: ctx.firstRun,
    fetched: messages.length,
    truncated,
    ...pipeline,
  };
}
/**
 * Stage an imported message into the pipeline: dedupe contact by
 * (userId, email), store the email, ensure a Deal exists with evidence,
 * and append sourced facts. Every claim is grounded in the email.
 */
export async function runPipeline(
  userId: string,
  messages: ImportedMessage[],
): Promise<PipelineResult> {
  const result: PipelineResult = {
    imported: 0,
    skipped: 0,
    contacts: 0,
    deals: 0,
    facts: 0,
    errors: [],
  };

  for (const msg of messages) {
    try {
      const { email: senderEmail, name: senderName } = parseFrom(msg.fromAddr);
      if (!senderEmail) {
        result.skipped += 1;
        result.errors.push(`Message ${msg.gmailId}: no parseable sender.`);
        continue;
      }

      // Dedupe check outside the transaction (cheap, idempotent).
      const alreadyImported = await prisma.email.findUnique({
        where: { userId_gmailId: { userId, gmailId: msg.gmailId } },
        select: { id: true },
      });
      if (alreadyImported) {
        result.skipped += 1;
        continue;
      }

      // Everything for this message lands atomically: contact upsert,
      // email row, deal evidence, facts — or none of it on failure.
      const staged = await prisma.$transaction(async (tx) => {
        // Contact dedupe: one contact per (userId, email).
        const existingContact = await tx.contact.findUnique({
          where: { userId_email: { userId, email: senderEmail } },
        });
        let contactId: string;
        let isNewContact = false;
        if (!existingContact) {
          const created = await tx.contact.create({
            data: {
              userId,
              email: senderEmail,
              name: senderName,
              source: "inbound",
              lastContact: msg.receivedAt,
            },
          });
          contactId = created.id;
          isNewContact = true;
        } else {
          await tx.contact.update({
            where: { id: existingContact.id },
            data: {
              lastContact: msg.receivedAt,
              ...(senderName && !existingContact.name ? { name: senderName } : {}),
            },
          });
          contactId = existingContact.id;
        }

        await tx.email.create({
          data: {
            userId,
            gmailId: msg.gmailId,
            threadId: msg.threadId,
            subject: msg.subject || "(no subject)",
            fromAddr: msg.fromAddr,
            body: msg.body || msg.snippet || "(no text)",
            direction: "INBOUND",
            receivedAt: msg.receivedAt,
            contactId,
          },
        });

        // Deal staging: one deal per contact, evidence-based whyInPipeline.
        let isNewDeal = false;
        const existingDeal = await tx.deal.findFirst({
          where: { userId, contactId },
          orderBy: { createdAt: "asc" },
        });
        if (!existingDeal) {
          await tx.deal.create({
            data: {
              userId,
              contactId,
              title: makeDealTitle(msg, senderName),
              stage: "INBOX",
              source: "email",
              whyInPipeline: evidenceFor(msg),
            },
          });
          isNewDeal = true;
        } else if (existingDeal.stage === "INBOX") {
          // Keep the evidence fresh but only while the deal is still INBOX;
          // a manually-moved deal keeps its reason.
          await tx.deal.update({
            where: { id: existingDeal.id },
            data: {
              whyInPipeline: `Latest ${evidenceFor(msg)}`,
              updatedAt: new Date(),
            },
          });
        }

        const facts = buildFacts(msg, contactId, userId);
        if (facts.length > 0) {
          await tx.fact.createMany({ data: facts });
        }
        return { contactId, isNewContact, isNewDeal, factCount: facts.length };
      });

      // Counters only advance after a committed transaction.
      result.imported += 1;
      if (staged.isNewContact) {
        result.contacts += 1;
        logger.debug("Created new contact", { userId, contactId: staged.contactId, email: senderEmail });
      }
      if (staged.isNewDeal) {
        result.deals += 1;
        logger.debug("Created new deal", { userId, dealId: "new", contactId: staged.contactId });
      }
      result.facts += staged.factCount;
      if (staged.factCount > 0) {
        logger.debug("Created facts", { userId, contactId: staged.contactId, factCount: staged.factCount });
      }
    } catch (err) {
      const errorMsg = `Message ${msg.gmailId}: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(errorMsg);
      logger.error("Failed to process message", { userId, gmailId: msg.gmailId, error: errorMsg });
    }
  }

  return result;
}