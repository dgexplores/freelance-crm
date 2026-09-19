import { streamFollowUpNudge, DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
import { aiErrorResponse } from "@/lib/ai/http";
import { getUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { checkAiQuota, recordAiUsage } from "@/lib/billing";

export const dynamic = "force-dynamic";

const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
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
      if (body?.days !== undefined) {
        const n = Number(body.days);
        const floored = Math.floor(n);
        if (!Number.isFinite(n) || floored < 1 || floored > 30) {
          return Response.json(
            { error: "Invalid days parameter. Must be an integer between 1 and 30." },
            { status: 400 },
          );
        }
        days = floored;
      }
    } catch {
      // fall through to validation below
    }
    if (!dealId) {
      return Response.json({ error: "Missing dealId in request body." }, { status: 400 });
    }

    await checkAiQuota(user.id);
    const stream = await streamFollowUpNudge(user.id, dealId, days);
    await recordAiUsage(user.id);
    // Pre-stream errors map to JSON via aiErrorResponse; mid-stream failures
    // propagate as an aborted body once headers are sent.
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
