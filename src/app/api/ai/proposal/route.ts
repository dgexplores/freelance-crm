import { generateProposalDraft } from "@/lib/ai/proposal";
import { aiErrorResponse, readDealId } from "@/lib/ai/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const dealId = await readDealId(request);
    const proposal = await generateProposalDraft(dealId);
    return Response.json({ dealId, proposal });
  } catch (err) {
    return aiErrorResponse(err);
  }
}