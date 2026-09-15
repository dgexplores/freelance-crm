/**
 * Typed application errors. Route handlers map these to HTTP responses by
 * instanceof — never by matching error message strings.
 */
export type AppErrorCode =
  | "bad_request"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "unavailable"
  | "upstream"
  | "internal";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: AppErrorCode = "internal",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Invalid request.") {
    super(message, 400, "bad_request");
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, 404, "not_found");
    this.name = "NotFoundError";
  }
}

/** Domain rule violated (wrong stage, missing rate card, not stale, ...). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "conflict");
    this.name = "ConflictError";
  }
}

export class UnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable.") {
    super(message, 503, "unavailable");
    this.name = "UnavailableError";
  }
}

/** A dependency (Gmail, Gemini) failed. Safe-ish to surface its message. */
export class UpstreamError extends AppError {
  constructor(message: string) {
    super(message, 502, "upstream");
    this.name = "UpstreamError";
  }
}

/**
 * Server actions return a user-facing `message` string, so they must not hand
 * back raw `err.message` — a Prisma failure would surface constraint names and
 * column details in the UI. Known domain errors carry a message written for
 * humans; everything else is logged in full server-side and replaced with a
 * generic string. Route handlers use `aiErrorResponse` for the same job.
 */
export function safeActionMessage(
  err: unknown,
  fallback: string,
  onUnexpected?: (detail: string) => void,
): string {
  if (err instanceof AppError) return err.message;
  const detail = err instanceof Error ? err.stack ?? err.message : String(err);
  onUnexpected?.(detail);
  return fallback;
}
