import { scheduleStaleFollowUpsAction } from "@/app/board/[dealId]/schedule-actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env["CRON_SECRET"];
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await scheduleStaleFollowUpsAction();
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron job failed";
    return Response.json({ ok: false, message, scheduled: 0, errors: [message] }, { status: 500 });
  }
}