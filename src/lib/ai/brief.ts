import { AiUnavailableError, generateTextWithRetry } from "@/lib/ai/gemini";
import { loadDealContext, formatEmails } from "@/lib/ai/context";

/**
 * Pre-call brief for a deal: who the contact is, what they last said,
 * where the deal stands, and what to confirm next.
 */
export async function generateDealBrief(userId: string, dealId: string): Promise<string> {
  const ctx = await loadDealContext(userId, dealId);
  if (!ctx.user.rateCard) {
    throw new Error(
      "No rate card on your account yet — add one (markdown: rates, services, terms) to get useful briefs.",
    );
  }

  const prompt = `You are the assistant of a solo freelancer. Write a concise pre-call brief in Markdown.

# The freelancer
Name: ${ctx.user.name ?? ctx.user.email}
Their rate card (markdown):
${ctx.user.rateCard}

# The prospect
Name: ${ctx.contact.name ?? "unknown"}
Company: ${ctx.contact.company ?? "unknown"}
Email: ${ctx.contact.email}
LinkedIn: ${ctx.contact.linkedinUrl ?? "n/a"}
Source: ${ctx.contact.source ?? "unknown"}

# The deal
Title: ${ctx.deal.title}
Stage: ${ctx.deal.stage}
Estimated value: ${ctx.deal.value ? `$${ctx.deal.value}` : "unknown"}
Why it is in the pipeline: ${ctx.deal.whyInPipeline ?? "n/a"}

# Recent email history (newest first)
${formatEmails(ctx.emails) || "(none)"}

# Brief format — exactly these sections, short bullets:
1. **Who they are** — 1-2 lines, only facts with a source above. Never invent.
2. **What they last said** — the latest ask, question, or objection, quoted from the emails.
3. **Where the deal stands** — stage, value, and the open question.
4. **What to confirm** — 2-3 concrete things to confirm on the call.
5. **Suggested talking points** — 2-3 bullets tied to their rate card.`;

  try {
    return await generateTextWithRetry(prompt, {
      temperature: 0.4,
      maxOutputTokens: 1024,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    throw new Error(`Brief generation failed: ${(err as Error).message}`);
  }
}
