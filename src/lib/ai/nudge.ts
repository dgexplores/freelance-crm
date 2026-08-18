import { AiUnavailableError, generateText } from "@/lib/ai/gemini";
import {
  NUDGE_STAGES,
  formatEmails,
  idleDays,
  isStaleDeal,
  loadDealContext,
} from "@/lib/ai/context";
import type { Deal } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_STALE_DAYS = 5;

export interface StaleDeal {
  dealId: string;
  title: string;
  stage: Deal["stage"];
  value: number | null;
  contactName: string | null;
  contactEmail: string;
  company: string | null;
  idleDays: number;
  lastActivityAt: Date;
  whyInPipeline: string | null;
}

/** Deals in INBOX/QUALIFIED with no activity for >= `days` days. */
export async function listStaleDeals(days: number = DEFAULT_STALE_DAYS): Promise<StaleDeal[]> {
  const deals = await prisma.deal.findMany({
    where: { stage: { in: NUDGE_STAGES } },
    include: { contact: true },
    orderBy: { updatedAt: "asc" },
  });

  const stale: StaleDeal[] = [];
  for (const deal of deals) {
    const ctx = await loadDealContext(deal.id);
    if (!isStaleDeal(ctx, days)) continue;
    stale.push({
      dealId: deal.id,
      title: deal.title,
      stage: deal.stage,
      value: deal.value,
      contactName: deal.contact.name,
      contactEmail: deal.contact.email,
      company: deal.contact.company,
      idleDays: idleDays(ctx),
      lastActivityAt: ctx.lastActivityAt,
      whyInPipeline: deal.whyInPipeline,
    });
  }
  return stale.sort((a, b) => b.idleDays - a.idleDays);
}

export interface FollowUpNudge {
  dealId: string;
  title: string;
  idleDays: number;
  draft: string;
}

/**
 * Draft a follow-up nudge for a stale INBOX/QUALIFIED deal.
 * Returns the draft; the caller decides whether to send or schedule it.
 */
export async function generateFollowUpNudge(
  dealId: string,
  days: number = DEFAULT_STALE_DAYS,
): Promise<FollowUpNudge> {
  const ctx = await loadDealContext(dealId);
  if (!isStaleDeal(ctx, days)) {
    throw new Error(
      `Deal "${ctx.deal.title}" is not stale (stage ${ctx.deal.stage}, ${idleDays(ctx)}d idle; needs ${days}d in ${NUDGE_STAGES.join("/")}).`,
    );
  }

  const prompt = `You are the assistant of a solo freelancer. The prospect went quiet. Write ONE short, human follow-up email draft that re-opens the conversation without pressure.

# The freelancer
Name: ${ctx.user.name ?? ctx.user.email}

# The prospect
Name: ${ctx.contact.name ?? ctx.contact.email}
Company: ${ctx.contact.company ?? "unknown"}

# The deal
Title: ${ctx.deal.title}
Stage: ${ctx.deal.stage}
Estimated value: ${ctx.deal.value ? `$${ctx.deal.value}` : "unknown"}
Why it is in the pipeline: ${ctx.deal.whyInPipeline ?? "n/a"}
Idle for: ${idleDays(ctx)} days

# Recent email history (newest first)
${formatEmails(ctx.emails, 4) || "(none)"}

# Output format — exact:
Subject: <one line>
Draft:
<2-4 sentence email body. Reference something specific from the real thread. Ask a single low-friction question. Do not apologize repeatedly. No fluff.>`;

  try {
    const draft = await generateText(prompt, {
      temperature: 0.5,
      maxOutputTokens: 700,
    });
    return { dealId: ctx.deal.id, title: ctx.deal.title, idleDays: idleDays(ctx), draft };
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    throw new Error(`Nudge generation failed: ${(err as Error).message}`);
  }
}
