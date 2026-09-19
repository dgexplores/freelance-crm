import { timingSafeEqual } from "node:crypto";
import { scheduleFollowUpsAllUsers } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret (fail-closed, constant-time compare).
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env["CRON_SECRET"];
  const expected = cronSecret ? `Bearer ${cronSecret}` : "";
  const a = Buffer.from(authHeader ?? "");
  const b = Buffer.from(expected);
  if (!cronSecret || !authHeader || a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await scheduleFollowUpsAllUsers();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cron job failed";
    return Response.json(
      { ok: false, message, scheduled: 0, errors: [message], usersScanned: 0 },
      { status: 500 },
    );
  }
}
