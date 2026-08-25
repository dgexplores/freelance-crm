import { streamFollowUpNudge, DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
import { aiErrorResponse } from "@/lib/ai/http";
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
    rateLimit(`ai:nudge:${user.id}`, RATE_LIMIT);
    let dealId = "";
    let days = DEFAULT_STALE_DAYS;
    try {
      const body = (await request.json()) as { dealId?: unknown; days?: unknown };
      if (typeof body?.dealId === "string" && body.dealId) dealId = body.dealId;
      const n = Number(body?.days);
      if (Number.isFinite(n) && n >= 1) days = Math.floor(n);
    } catch {
      // fall through to validation below
    }
    if (!dealId) {
      return Response.json({ error: "Missing dealId in request body." }, { status: 400 });
    }

    const stream = await streamFollowUpNudge(user.id, dealId, days);
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
