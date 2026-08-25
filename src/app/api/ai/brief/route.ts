import { generateDealBrief } from "@/lib/ai/brief";
import { aiErrorResponse, readDealId } from "@/lib/ai/http";
import { getUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Generation costs real tokens — cap abuse per user.
const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    rateLimit(`ai:brief:${user.id}`, RATE_LIMIT);
    const dealId = await readDealId(request);
    const brief = await generateDealBrief(user.id, dealId);
    return Response.json({ dealId, brief });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
