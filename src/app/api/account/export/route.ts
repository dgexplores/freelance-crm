import { getUser } from "@/lib/session";
import { collectUserData } from "@/lib/account";
import { logger } from "@/lib/logger";

// Reads the session and the database on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/account/export` — download everything the account owns as JSON.
 *
 * Not covered by the middleware matcher (which only guards /board and
 * /settings), so the session check here is the access control.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const data = await collectUserData(user.id);
    const filename = `inbox-crm-export-${new Date().toISOString().slice(0, 10)}.json`;

    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Personal data: never let a proxy or browser cache it.
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    logger.error("Account export failed", {
      userId: user.id,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    return Response.json(
      { error: "Export failed. Please try again." },
      { status: 500 },
    );
  }
}
