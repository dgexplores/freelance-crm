"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";

export type ActionResult = {
  ok: boolean;
  message: string;
};

// Rate card goes straight into AI prompts — cap it so one giant paste can't
// blow up token costs or degrade generation quality.
const MAX_RATE_CARD_LENGTH = 20_000;

export async function updateRateCardAction(rateCard: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  if (typeof rateCard !== "string") {
    return { ok: false, message: "Invalid rate card content." };
  }
  if (rateCard.length > MAX_RATE_CARD_LENGTH) {
    return {
      ok: false,
      message: `Rate card is too long (${rateCard.length} chars; max ${MAX_RATE_CARD_LENGTH}).`,
    };
  }
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { rateCard: rateCard.trim() || null },
    });
    revalidatePath("/settings");
    revalidatePath("/board");
    return { ok: true, message: "Rate card saved." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save rate card.";
    return { ok: false, message };
  }
}

export async function updateProfileAction(name: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  const clean = typeof name === "string" ? name.trim().slice(0, 120) : "";
  try {
    await prisma.user.update({ where: { id: user.id }, data: { name: clean || null } });
    revalidatePath("/settings");
    revalidatePath("/board");
    return { ok: true, message: "Profile saved." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to save profile." };
  }
}

export async function updatePreferencesAction(
  staleDays: number,
  autoFollowUp: boolean,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  const floored = Math.floor(staleDays);
  if (!Number.isFinite(staleDays) || floored < 1 || floored > 30) {
    return { ok: false, message: "Stale threshold must be 1–30 days." };
  }
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { staleDays: floored, autoFollowUp: Boolean(autoFollowUp) },
    });
    revalidatePath("/settings");
    revalidatePath("/board");
    return { ok: true, message: "Preferences saved." };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022") {
      return { ok: false, message: "Preferences unavailable until the database is migrated (`npm run db:push`)." };
    }
    return { ok: false, message: err instanceof Error ? err.message : "Failed to save preferences." };
  }
}

/** Disconnect Google: drop OAuth accounts so the next Gmail action re-auths. */
export async function disconnectGmailAction(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  try {
    await prisma.account.deleteMany({ where: { userId: user.id, providerId: "google" } });
    await prisma.user.update({ where: { id: user.id }, data: { gmailSyncStartedAt: null } });
    revalidatePath("/settings");
    revalidatePath("/board");
    return { ok: true, message: "Gmail disconnected. Reconnect on next import." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to disconnect." };
  }
}

/**
 * Delete all pipeline data (deals, tasks, emails, facts, contacts).
 * Keeps the user row, rate card, and preferences. Requires typed confirm.
 */
export async function deletePipelineDataAction(confirm: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  if (confirm !== "DELETE") {
    return { ok: false, message: 'Type DELETE to confirm.' };
  }
  try {
    const deals = await prisma.deal.findMany({ where: { userId: user.id }, select: { id: true } });
    const dealIds = deals.map((d) => d.id);
    await prisma.$transaction([
      prisma.task.deleteMany({ where: { dealId: { in: dealIds } } }),
      prisma.deal.deleteMany({ where: { userId: user.id } }),
      prisma.email.deleteMany({ where: { userId: user.id } }),
      prisma.fact.deleteMany({ where: { userId: user.id } }),
      prisma.contact.deleteMany({ where: { userId: user.id } }),
    ]);
    revalidatePath("/settings");
    revalidatePath("/board");
    return { ok: true, message: "Pipeline data deleted." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Delete failed." };
  }
}