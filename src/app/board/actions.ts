"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { importGmail } from "@/lib/pipeline";

export const DEAL_STAGES = ["INBOX", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;
export type DealStageValue = (typeof DEAL_STAGES)[number];

export type ActionResult = {
  ok: boolean;
  message: string;
};

export async function importGmailAction(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
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
    return {
      ok: true,
      message: `Import done: ${summary}${detail}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail import failed.";
    return { ok: false, message };
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
  await prisma.deal.update({
    where: { id: deal.id },
    data: {
      stage: toStage as DealStageValue,
      ...(toStage === "WON" && !deal.wonAt ? { wonAt: new Date() } : {}),
      // Leaving WON clears the timestamp; stale wonAt on an open deal is a lie.
      ...(deal.stage === "WON" && toStage !== "WON" ? { wonAt: null } : {}),
      // Reopening clears the loss reason; entering LOST leaves it null until
      // a real reason is recorded elsewhere.
      ...(toStage !== "LOST" && deal.lostReason ? { lostReason: null } : {}),
    },
  });
  revalidatePath("/board");
  return { ok: true, message: `Moved to ${toStage}.` };
}