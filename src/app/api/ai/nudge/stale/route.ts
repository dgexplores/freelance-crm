import { listStaleDeals, DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
import { aiErrorResponse } from "@/lib/ai/http";
import { getUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = { limit: 30, windowMs: 60_000 };

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    rateLimit(`ai:stale:${user.id}`, RATE_LIMIT);
    const { searchParams } = new URL(request.url);
    const raw = Number(searchParams.get("days"));
    const days = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_STALE_DAYS;
    const stale = await listStaleDeals(user.id, days);
    return Response.json({ days, count: stale.length, deals: stale });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
