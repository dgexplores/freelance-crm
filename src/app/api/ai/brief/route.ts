import { generateDealBrief } from "@/lib/ai/brief";
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
    const brief = await generateDealBrief(user.id, dealId);
    return Response.json({ dealId, brief });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
