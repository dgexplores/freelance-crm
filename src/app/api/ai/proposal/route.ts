import { generateProposalDraft } from "@/lib/ai/proposal";
import { aiErrorResponse, readDealId } from "@/lib/ai/http";
import { getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const dealId = await readDealId(request);
    const proposal = await generateProposalDraft(user.id, dealId);
    return Response.json({ dealId, proposal });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
