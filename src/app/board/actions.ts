"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { importGmail } from "@/lib/pipeline";
import { scheduleFollowUpsForUser } from "@/lib/scheduler";
import { DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
import { safeActionMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * Pipeline stages, in order. Module-private on purpose: a `"use server"` file
 * may only export async functions, so exporting this value would fail the
 * build. Nothing outside this module needs it.
 */
const DEAL_STAGES = ["INBOX", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;
type DealStageValue = (typeof DEAL_STAGES)[number];

export type ActionResult = {
  ok: boolean;
  message: string;
};

/**
 * An import fans out to as many Gmail API calls as there are new messages, so
 * it is the most expensive thing a user can trigger. Rate-limit it the same way
 * the AI routes are limited.
 */
const IMPORT_RATE_LIMIT = { limit: 6, windowMs: 60_000 };

export async function importGmailAction(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  try {
    rateLimit(`gmail:import:${user.id}`, IMPORT_RATE_LIMIT);
  } catch (err) {
    return { ok: false, message: safeActionMessage(err, "Import failed.") };
  }
  try {
    const result = await importGmail(user.id);
    revalidatePath("/board");
    const summary = [
      result.fetched > 0 ? `${result.fetched} fetched` : null,
      result.imported > 0 ? `${result.imported} new` : "0 new",
      result.contacts > 0 ? `${result.contacts} contacts` : null,
      result.deals > 0 ? `${result.deals} deals` : null,
      result.facts > 0 ? `${result.facts} facts` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const detail = result.errors.length ? ` (${result.errors.length} errors)` : "";
    // Truncation means older mail in this window was skipped. Say so plainly
    // rather than reporting a clean import.
    const truncated = result.truncated
      ? " — more mail existed than one run could fetch, so older messages in this window were skipped. Import again to continue."
      : "";
    return {
      ok: true,
      message: `Import done: ${summary}${detail}${truncated}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Gmail import failed.", (detail) =>
        logger.error("Gmail import failed", { userId: user.id, error: detail }),
      ),
    };
  }
}

export async function moveDealAction(
  dealId: string,
  toStage: string,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  if (!DEAL_STAGES.includes(toStage as DealStageValue)) {
    return { ok: false, message: "Invalid stage." };
  }
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, userId: user.id },
  });
  if (!deal) {
    return { ok: false, message: "Deal not found." };
  }
  try {
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        stage: toStage as DealStageValue,
        ...(toStage === "WON" && !deal.wonAt ? { wonAt: new Date() } : {}),
        // Leaving WON clears the timestamp; stale wonAt on an open deal is a lie.
        ...(deal.stage === "WON" && toStage !== "WON" ? { wonAt: null } : {}),
        // Entering LOST without a reason keeps the field honest for reporting.
        ...(toStage === "LOST" && !deal.lostReason
          ? { lostReason: "No reason recorded." }
          : {}),
      },
    });
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Could not move the deal.", (detail) =>
        logger.error("Deal move failed", { userId: user.id, dealId, error: detail }),
      ),
    };
  }
  revalidatePath("/board");
  return { ok: true, message: `Moved to ${toStage}.` };
}

/** Fields a user may correct by hand. The pipeline only ever infers these. */
export type DealEdit = {
  title?: string;
  value?: number | null;
  lostReason?: string | null;
};

const MAX_TITLE_LENGTH = 200;

/**
 * Manual correction of pipeline-inferred data. Without this the board is
 * read-only: `value` is never set by the importer, so every deal would show
 * "Not set" and every AI prompt would read "Estimated value: unknown" forever.
 */
export async function updateDealAction(
  dealId: string,
  edit: DealEdit,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const deal = await prisma.deal.findFirst({ where: { id: dealId, userId: user.id } });
  if (!deal) return { ok: false, message: "Deal not found." };

  const data: { title?: string; value?: number | null; lostReason?: string | null } = {};

  if (edit.title !== undefined) {
    const title = edit.title.trim();
    if (!title) return { ok: false, message: "Title cannot be empty." };
    if (title.length > MAX_TITLE_LENGTH) {
      return { ok: false, message: `Title is too long (max ${MAX_TITLE_LENGTH} characters).` };
    }
    data.title = title;
  }

  if (edit.value !== undefined) {
    if (edit.value === null || edit.value === 0) {
      data.value = null;
    } else {
      if (!Number.isFinite(edit.value) || edit.value < 0) {
        return { ok: false, message: "Value must be a positive number." };
      }
      data.value = Math.round(edit.value);
    }
  }

  if (edit.lostReason !== undefined) {
    const reason = edit.lostReason?.trim() ?? "";
    data.lostReason = reason || null;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, message: "Nothing to update." };
  }

  try {
    await prisma.deal.update({ where: { id: deal.id }, data });
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Could not save the deal.", (detail) =>
        logger.error("Deal update failed", { userId: user.id, dealId, error: detail }),
      ),
    };
  }

  revalidatePath("/board");
  revalidatePath(`/board/${dealId}`);
  return { ok: true, message: "Deal updated." };
}

export type ContactEdit = {
  name?: string | null;
  company?: string | null;
  linkedinUrl?: string | null;
};

const MAX_NAME_LENGTH = 200;

/**
 * Contact fields are never populated by the importer (signature-block parsing
 * is not implemented), so this is the only way they can ever be filled in.
 */
export async function updateContactAction(
  contactId: string,
  edit: ContactEdit,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, userId: user.id },
  });
  if (!contact) return { ok: false, message: "Contact not found." };

  const data: { name?: string | null; company?: string | null; linkedinUrl?: string | null } = {};

  const clean = (raw: string | null | undefined, max: number) => {
    const value = raw?.trim() ?? "";
    if (value.length > max) return null;
    return value || null;
  };

  if (edit.name !== undefined) {
    const name = clean(edit.name, MAX_NAME_LENGTH);
    if (edit.name && edit.name.trim().length > MAX_NAME_LENGTH) {
      return { ok: false, message: `Name is too long (max ${MAX_NAME_LENGTH} characters).` };
    }
    data.name = name;
  }
  if (edit.company !== undefined) data.company = clean(edit.company, MAX_NAME_LENGTH);
  if (edit.linkedinUrl !== undefined) {
    const url = clean(edit.linkedinUrl, 500);
    if (url && !/^https?:\/\//i.test(url)) {
      return { ok: false, message: "LinkedIn URL must start with http:// or https://" };
    }
    data.linkedinUrl = url;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, message: "Nothing to update." };
  }

  try {
    await prisma.contact.update({ where: { id: contact.id }, data });
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Could not save the contact.", (detail) =>
        logger.error("Contact update failed", { userId: user.id, contactId, error: detail }),
      ),
    };
  }

  revalidatePath("/board");
  return { ok: true, message: "Contact updated." };
}

/** Mark a fact as applied/unapplied — the evidence ledger's review action. */
export async function setFactAppliedAction(
  factId: string,
  applied: boolean,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };

  const fact = await prisma.fact.findFirst({ where: { id: factId, userId: user.id } });
  if (!fact) return { ok: false, message: "Fact not found." };

  try {
    await prisma.fact.update({ where: { id: fact.id }, data: { applied } });
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Could not update the fact.", (detail) =>
        logger.error("Fact update failed", { userId: user.id, factId, error: detail }),
      ),
    };
  }
  return { ok: true, message: applied ? "Fact applied." : "Fact unapplied." };
}

export type ScheduleResult = ActionResult & { scheduled: number; errors: string[] };

/**
 * Schedule follow-up nudges for the signed-in user's stale deals on demand,
 * instead of waiting for the daily cron. Session-scoped wrapper around the
 * shared scheduler in @/lib/scheduler.
 */
export async function scheduleStaleFollowUpsAction(
  days: number = DEFAULT_STALE_DAYS,
): Promise<ScheduleResult> {
  const user = await getUser();
  if (!user) {
    return { ok: false, message: "Not authenticated.", scheduled: 0, errors: [] };
  }

  const window = Number.isFinite(days) && days >= 1 ? Math.floor(days) : DEFAULT_STALE_DAYS;

  try {
    const result = await scheduleFollowUpsForUser(user.id, window);
    revalidatePath("/board");
    return {
      ok: true,
      message: `Scheduled ${result.scheduled} follow-up${result.scheduled !== 1 ? "s" : ""}.`,
      scheduled: result.scheduled,
      errors: result.errors,
    };
  } catch (err) {
    return {
      ok: false,
      message: safeActionMessage(err, "Scheduling failed.", (detail) =>
        logger.error("Stale follow-up scheduling failed", { userId: user.id, error: detail }),
      ),
      scheduled: 0,
      errors: [],
    };
  }
}