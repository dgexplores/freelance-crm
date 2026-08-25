import { AiUnavailableError, generateTextWithRetry } from "@/lib/ai/gemini";
import { formatEmails, loadDealContext } from "@/lib/ai/context";
import { ConflictError } from "@/lib/errors";

/**
 * Proposal draft for a PROPOSAL-stage deal, written from the user's rate
 * card (services, rates, terms) and the actual thread with the contact.
 */
export async function generateProposalDraft(userId: string, dealId: string): Promise<string> {
  const ctx = await loadDealContext(userId, dealId);
  if (ctx.deal.stage !== "PROPOSAL") {
    throw new ConflictError(
      `Deal "${ctx.deal.title}" is in stage ${ctx.deal.stage}; proposals are only generated for PROPOSAL-stage deals.`,
    );
  }
  if (!ctx.user.rateCard) {
    throw new ConflictError(
      "No rate card on your account yet — add one (markdown: rates, services, terms) to draft proposals.",
    );
  }

  const prompt = `You are the assistant of a solo freelancer. Write a professional proposal draft in Markdown for this prospect. Only use services, rates, and terms that exist on the rate card; if the requested work has no matching line item, say so explicitly instead of inventing a price.

# The freelancer
Name: ${ctx.user.name ?? ctx.user.email}

# Rate card (markdown)
${ctx.user.rateCard}

# The prospect
Name: ${ctx.contact.name ?? ctx.contact.email}
Company: ${ctx.contact.company ?? "unknown"}

# The deal
Title: ${ctx.deal.title}
Stage: ${ctx.deal.stage}
Estimated value: ${ctx.deal.value ? `$${ctx.deal.value}` : "not set"}
Why it is in the pipeline: ${ctx.deal.whyInPipeline ?? "n/a"}

# Recent email history (newest first)
${formatEmails(ctx.emails) || "(none)"}

# Proposal format — exact sections, Markdown:
# Proposal for ${ctx.contact.company ?? ctx.contact.name}
## Overview
(1 short paragraph: the problem from the emails, what you propose.)
## Scope of Work
(bullets tied to what the prospect actually asked for.)
## Fees
(table or bullets pulled verbatim from the rate card; no invented numbers.)
## Terms
(bullets pulled verbatim from the rate card.)
## Next Steps
(2-3 concrete steps, including first availability.)`;

  try {
    return await generateTextWithRetry(prompt, {
      temperature: 0.4,
      maxOutputTokens: 2048,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    throw new Error(`Proposal generation failed: ${(err as Error).message}`);
  }
}
