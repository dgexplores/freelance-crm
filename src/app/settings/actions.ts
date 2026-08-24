"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";

export type ActionResult = {
  ok: boolean;
  message: string;
};

export async function updateRateCardAction(rateCard: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Not authenticated." };
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