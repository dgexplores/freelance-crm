import { streamProposalDraft } from "@/lib/ai/proposal";
import { aiErrorResponse, readDealId } from "@/lib/ai/http";
import { getUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    rateLimit(`ai:proposal:${user.id}`, RATE_LIMIT);
    const dealId = await readDealId(request);
    const stream = await streamProposalDraft(user.id, dealId);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
