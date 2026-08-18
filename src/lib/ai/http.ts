import { AiUnavailableError } from "@/lib/ai/gemini";

/**
 * Map any error thrown by the AI service layer to a JSON Response.
 * Missing key => 503 (graceful, never crash). Upstream failures => 502.
 * Domain errors (bad stage, not stale, missing rate card) => 409.
 * Not found => 404.
 */
export function aiErrorResponse(err: unknown): Response {
  if (err instanceof AiUnavailableError) {
    return Response.json(
      {
        error: "AI is not configured. Set GEMINI_API_KEY to enable AI features.",
      },
      { status: 503 },
    );
  }

  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("dealId") || message === "Deal not found") {
    return Response.json({ error: message }, { status: message === "Deal not found" ? 404 : 400 });
  }
  if (
    message.includes("rate card") ||
    message.includes("not stale") ||
    message.includes("only generated for PROPOSAL")
  ) {
    return Response.json({ error: message }, { status: 409 });
  }
  if (message.startsWith("Gemini API error")) {
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({ error: message }, { status: 500 });
}

export async function readDealId(request: Request): Promise<string> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("Expected a JSON body with a dealId.");
  }
  const dealId =
    body && typeof body === "object" && "dealId" in body
      ? String((body as { dealId: unknown }).dealId)
      : "";
  if (!dealId) throw new Error("Missing dealId in request body.");
  return dealId;
}
