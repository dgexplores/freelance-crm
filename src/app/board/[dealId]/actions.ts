"use server";

import { getUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateDealBrief } from "@/lib/ai/brief";
import { generateProposalDraft } from "@/lib/ai/proposal";
import { generateFollowUpNudge } from "@/lib/ai/nudge";
import { AiUnavailableError } from "@/lib/ai/gemini";

export type ActionResult<T = unknown> = {
  ok: boolean;
  message: string;
  data?: T;
};

export async function generateBriefAction(dealId: string): Promise<ActionResult<string>> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  const deal = await prisma.deal.findFirst({ where: { id: dealId, userId: user.id } });
  if (!deal) return { ok: false, message: "Deal not found." };
  try {
    const brief = await generateDealBrief(dealId);
    return { ok: true, message: "Brief generated.", data: brief };
  } catch (err) {
    if (err instanceof AiUnavailableError) return { ok: false, message: "AI not configured. Set GEMINI_API_KEY." };
    return { ok: false, message: err instanceof Error ? err.message : "Failed to generate brief." };
  }
}

export async function generateProposalAction(dealId: string): Promise<ActionResult<string>> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  const deal = await prisma.deal.findFirst({ where: { id: dealId, userId: user.id } });
  if (!deal) return { ok: false, message: "Deal not found." };
  try {
    const proposal = await generateProposalDraft(dealId);
    return { ok: true, message: "Proposal generated.", data: proposal };
  } catch (err) {
    if (err instanceof AiUnavailableError) return { ok: false, message: "AI not configured. Set GEMINI_API_KEY." };
    return { ok: false, message: err instanceof Error ? err.message : "Failed to generate proposal." };
  }
}

export async function generateNudgeAction(dealId: string): Promise<ActionResult<{ draft: string }>> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
  const deal = await prisma.deal.findFirst({ where: { id: dealId, userId: user.id } });
  if (!deal) return { ok: false, message: "Deal not found." };
  try {
    const nudge = await generateFollowUpNudge(dealId);
    return { ok: true, message: "Nudge generated.", data: { draft: nudge.draft } };
  } catch (err) {
    if (err instanceof AiUnavailableError) return { ok: false, message: "AI not configured. Set GEMINI_API_KEY." };
    return { ok: false, message: err instanceof Error ? err.message : "Failed to generate nudge." };
  }
}