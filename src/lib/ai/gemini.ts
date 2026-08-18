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

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiUnavailableError();

  const model = options.model ?? DEFAULT_GEMINI_MODEL;
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    throw new Error(`Gemini API error ${res.status}: ${detail}`);
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
