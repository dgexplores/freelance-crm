import { isNetworkError, withRetry } from "@/lib/retry";

export const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

/**
 * Raised when GEMINI_API_KEY is missing. Callers map this to HTTP 503.
 */
export class AiUnavailableError extends Error {
  constructor(message = "GEMINI_API_KEY is not set") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** Upstream Gemini failure with HTTP status, so callers can retry transient codes. */
export class GeminiApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(`Gemini API error ${status}: ${message}`);
    this.name = "GeminiApiError";
  }
}

export function geminiConfigured(): boolean {
  return Boolean(process.env["GEMINI_API_KEY"]);
}

export interface GenerateTextOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Env-guarded single call to the Gemini generateContent endpoint.
 * Throws AiUnavailableError when the key is unset; throws a plain Error
 * (with the upstream status/message) on API failure.
 */
export async function generateText(
  prompt: string,
  options: GenerateTextOptions = {},
): Promise<string> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new AiUnavailableError();

  const model = options.model ?? DEFAULT_GEMINI_MODEL;
  // API key goes in a header, never in the URL — query strings leak into
  // proxy and access logs.
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    cache: "no-store",
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens ?? 4096,
      },
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    throw new GeminiApiError(detail || res.statusText, res.status);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text =
    data?.candidates
      ?.flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

/** Rate limits and upstream server faults are worth retrying. */
function isTransientGeminiError(err: unknown): boolean {
  if (isNetworkError(err)) return true;
  if (err instanceof GeminiApiError) {
    return err.status === 429 || err.status >= 500;
  }
  return false;
}

/** Generate text with bounded retry/backoff on transient upstream failures. */
export async function generateTextWithRetry(
  prompt: string,
  options: GenerateTextOptions = {},
): Promise<string> {
  return withRetry(() => generateText(prompt, options), {
    retryOn: isTransientGeminiError,
  });
}
