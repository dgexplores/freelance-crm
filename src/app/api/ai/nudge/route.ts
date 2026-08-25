import { generateFollowUpNudge, DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
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
    if (!dealId) throw new Error("Missing dealId in request body.");

    const nudge = await generateFollowUpNudge(user.id, dealId, days);
    return Response.json(nudge);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
