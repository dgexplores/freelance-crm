import { generateDealBrief } from "@/lib/ai/brief";
import { aiErrorResponse, readDealId } from "@/lib/ai/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const dealId = await readDealId(request);
    const brief = await generateDealBrief(dealId);
    return Response.json({ dealId, brief });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
