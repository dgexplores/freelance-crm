import { listStaleDeals, DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
import { aiErrorResponse } from "@/lib/ai/http";
import { getUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = { limit: 30, windowMs: 60_000 };

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    rateLimit(`ai:stale:${user.id}`, RATE_LIMIT);
    const { searchParams } = new URL(request.url);
    const rawParam = searchParams.get("days");
    let days = DEFAULT_STALE_DAYS;
    if (rawParam !== null) {
      const raw = Number(rawParam);
      const floored = Math.floor(raw);
      if (!Number.isFinite(raw) || floored < 1 || floored > 30) {
        return Response.json(
          { error: "Invalid days parameter. Must be an integer between 1 and 30." },
          { status: 400 },
        );
      }
      days = floored;
    }
    const stale = await listStaleDeals(user.id, days);
    return Response.json({ days, count: stale.length, deals: stale });
  } catch (err) {
    return aiErrorResponse(err, requestId);
  }
}
