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

/**
 * Orchestrate a forward-only import run:
 *  1. resolve the forward-only boundary (recorded on first successful run)
 *  2. fetch only messages newer than the boundary (gmail.readonly)
 *  3. stage them into contacts/deals/facts
 *  4. persist the boundary only after a successful run (no lost mail)
 */
export async function importGmail(
  userId: string,
): Promise<ImportResult & PipelineResult> {
  const ctx = await getImportContext(userId);

  logger.info("Starting Gmail import", { userId, firstRun: ctx.firstRun, sinceMs: ctx.sinceMs });

  const messages = await fetchNewMessages(userId, ctx.sinceMs);

  logger.info("Fetched messages from Gmail", { userId, count: messages.length });

  const pipeline = await runPipeline(userId, messages);

  const boundary = await prisma.user.findUnique({
    where: { id: userId },
    select: { gmailSyncStartedAt: true },
  });

  if (pipeline.errors.length === 0) {
    await recordForwardOnlyBoundary(userId);
    logger.info("Gmail import completed successfully", { userId, ...pipeline });
  } else {
    logger.warn("Gmail import completed with errors", { userId, ...pipeline });
  }

  return {
    boundary: boundary?.gmailSyncStartedAt ?? null,
    firstRun: ctx.firstRun,
    fetched: messages.length,
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
      const existing = await prisma.email.findUnique({
        where: { userId_gmailId: { userId, gmailId: msg.gmailId } },
      });
      if (existing) {
        result.skipped += 1;
        continue;
      }

      const { email: senderEmail, name: senderName } = parseFrom(msg.fromAddr);
      if (!senderEmail) {
        result.skipped += 1;
        result.errors.push(`Message ${msg.gmailId}: no parseable sender.`);
        continue;
      }

      // Contact dedupe: one contact per (userId, email).
      const existingContact = await prisma.contact.findUnique({
        where: { userId_email: { userId, email: senderEmail } },
      });
      let contact = existingContact;
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            userId,
            email: senderEmail,
            name: senderName,
            source: "inbound",
            lastContact: msg.receivedAt,
          },
        });
        result.contacts += 1;
        logger.debug("Created new contact", { userId, contactId: contact.id, email: senderEmail });
      } else {
        contact = await prisma.contact.update({
          where: { id: contact.id },
          data: {
            lastContact: msg.receivedAt,
            ...(senderName && !contact.name ? { name: senderName } : {}),
          },
        });
      }

      await prisma.email.create({
        data: {
          userId,
          gmailId: msg.gmailId,
          threadId: msg.threadId,
          subject: msg.subject || "(no subject)",
          fromAddr: msg.fromAddr,
          body: msg.body || msg.snippet || "(no text)",
          direction: "INBOUND",
          receivedAt: msg.receivedAt,
          contactId: contact.id,
        },
      });

      // Deal staging: one deal per contact, evidence-based whyInPipeline.
      const existingDeal = await prisma.deal.findFirst({
        where: { userId, contactId: contact.id },
        orderBy: { createdAt: "asc" },
      });
      if (!existingDeal) {
        await prisma.deal.create({
          data: {
            userId,
            contactId: contact.id,
            title: makeDealTitle(msg, senderName),
            stage: "INBOX",
            source: "email",
            whyInPipeline: evidenceFor(msg),
          },
        });
        result.deals += 1;
        logger.debug("Created new deal", { userId, dealId: "new", contactId: contact.id });
      } else if (existingDeal.stage === "INBOX") {
        // Keep the evidence fresh but only while the deal is still INBOX;
        // a manually-moved deal keeps its reason.
        await prisma.deal.update({
          where: { id: existingDeal.id },
          data: {
            whyInPipeline: `Latest ${evidenceFor(msg)}`,
            updatedAt: new Date(),
          },
        });
      }

      const facts = buildFacts(msg, contact.id, userId);
      if (facts.length > 0) {
        await prisma.fact.createMany({ data: facts });
        result.facts += facts.length;
        logger.debug("Created facts", { userId, contactId: contact.id, factCount: facts.length });
      }

      result.imported += 1;
    } catch (err) {
      const errorMsg = `Message ${msg.gmailId}: ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(errorMsg);
      logger.error("Failed to process message", { userId, gmailId: msg.gmailId, error: errorMsg });
    }
  }

  return result;
}