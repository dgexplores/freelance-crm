import { listStaleDeals, DEFAULT_STALE_DAYS } from "@/lib/ai/nudge";
import { aiErrorResponse } from "@/lib/ai/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = Number(searchParams.get("days"));
    const days = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : DEFAULT_STALE_DAYS;
    const stale = await listStaleDeals(days);
    return Response.json({ days, count: stale.length, deals: stale });
  } catch (err) {
    return aiErrorResponse(err);
  }
}