import { generateFollowUpNudge, DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
import { aiErrorResponse } from "@/lib/ai/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
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

    const nudge = await generateFollowUpNudge(dealId, days);
    return Response.json(nudge);
  } catch (err) {
    return aiErrorResponse(err);
  }
}