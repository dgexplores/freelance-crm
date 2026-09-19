import { AppError, BadRequestError, NotFoundError } from "@/lib/errors";
import { AiUnavailableError, GeminiApiError } from "@/lib/ai/gemini";
import { RateLimitError } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * Map any error thrown by the AI service layer to a JSON Response.
 * Mapping is instanceof-based via the typed error hierarchy — message
 * strings are never parsed.
 */
export function aiErrorResponse(err: unknown, requestId?: string): Response {
  if (err instanceof RateLimitError) {
    return Response.json(
      { error: err.message },
      { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } },
    );
  }

  if (err instanceof AiUnavailableError) {
    return Response.json(
      {
        error:
          "AI is not configured. Set GEMINI_API_KEY to enable AI features.",
      },
      { status: 503 },
    );
  }

  if (err instanceof GeminiApiError) {
    logger.error("Gemini upstream failure", { status: err.status }, undefined, requestId);
    return Response.json(
      { error: "AI provider request failed. Try again shortly." },
      { status: 502 },
    );
  }

  // Known domain errors carry their own status + safe user-facing message.
  if (err instanceof AppError) {
    return Response.json({ error: err.message, code: err.code }, { status: err.status });
  }

  // Unknown errors: log full detail server-side, return a generic body so
  // internals never leak to clients.
  const detail = err instanceof Error ? err.stack ?? err.message : String(err);
  logger.error("Unhandled error in AI route", { error: detail }, undefined, requestId);
  return Response.json(
    { error: "Something went wrong. Please try again.", code: "internal" },
    { status: 500 },
  );
}

export async function readDealId(request: Request): Promise<string> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new BadRequestError("Expected a JSON body with a dealId.");
  }
  const dealId =
    body && typeof body === "object" && "dealId" in body
      ? String((body as { dealId: unknown }).dealId)
      : "";
  if (!dealId) throw new BadRequestError("Missing dealId in request body.");
  return dealId;
}

// Re-export for route handlers that want explicit not-found semantics.
export { NotFoundError };
