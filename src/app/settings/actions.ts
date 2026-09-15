"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { safeActionMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";

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
    return {
      ok: false,
      message: safeActionMessage(err, "Failed to save rate card.", (detail) =>
        logger.error("Rate card save failed", { userId: user.id, error: detail }),
      ),
    };
  }
}