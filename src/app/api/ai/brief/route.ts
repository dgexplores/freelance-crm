import { streamDealBrief } from "@/lib/ai/brief";
import { aiErrorResponse, readDealId } from "@/lib/ai/http";
import { getUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { checkAiQuota, recordAiUsage } from "@/lib/billing";

export const dynamic = "force-dynamic";

// Generation costs real tokens — cap abuse per user.
const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    rateLimit(`ai:brief:${user.id}`, RATE_LIMIT);
    await checkAiQuota(user.id);
    const dealId = await readDealId(request);
    // All validation errors throw before any bytes reach the client, so
    // they map to normal JSON responses via aiErrorResponse.
    const stream = await streamDealBrief(user.id, dealId);
    await recordAiUsage(user.id);
    // Pre-stream errors map to JSON via aiErrorResponse above; once headers
    // are sent, mid-stream failures propagate as an aborted body.
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return aiErrorResponse(err, requestId);
  }
}
