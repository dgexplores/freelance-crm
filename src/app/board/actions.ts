"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { importGmail } from "@/lib/pipeline";

export const DEAL_STAGES = ["INBOX", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;
export type DealStageValue = (typeof DEAL_STAGES)[number];

export type ActionResult = {
  ok: boolean;
  message: string;
};

export async function importGmailAction(): Promise<ActionResult> {
  const session = await requireUser();
  try {
    const result = await importGmail(session.user.id);
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
    const detail = result.errors.length
      ? ` (${result.errors.length} errors)`
      : "";
    return {
      ok: true,
      message: `Import done: ${summary}${detail}`,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gmail import failed.";
    return { ok: false, message };
  }
}

export async function moveDealAction(
  dealId: string,
  toStage: string,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!DEAL_STAGES.includes(toStage as DealStageValue)) {
    return { ok: false, message: "Invalid stage." };
  }
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, userId: session.user.id },
  });
  if (!deal) {
    return { ok: false, message: "Deal not found." };
  }
  await prisma.deal.update({
    where: { id: deal.id },
    data: {
      stage: toStage as DealStageValue,
      ...(toStage === "WON" ? { wonAt: new Date() } : {}),
    },
  });
  revalidatePath("/board");
  return { ok: true, message: `Moved to ${toStage}.` };
}