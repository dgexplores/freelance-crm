import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { openGeminiStream, AiUnavailableError, GeminiApiError } from "@/lib/ai/gemini";

/** Build a Response whose body is the given raw SSE frames, in order. */
function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

function textFrame(text: string): string {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe("openGeminiStream", () => {
  beforeEach(() => {
    process.env["GEMINI_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["GEMINI_API_KEY"];
  });

  it("throws AiUnavailableError when the key is not configured", async () => {
    delete process.env["GEMINI_API_KEY"];
    await expect(openGeminiStream("prompt")).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("strips SSE framing and emits plain text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse([textFrame("Hello"), textFrame(" world")])),
    );

    const stream = await openGeminiStream("prompt");
    expect(await readAll(stream)).toBe("Hello world");
  });

  it("emits a final frame that has no trailing newline", async () => {
    // The bug this guards: the transform only processed complete lines, and had
    // no flush(), so a final frame without a trailing newline stayed in the
    // buffer and the generation was silently truncated by one chunk.
    const last = JSON.stringify({ candidates: [{ content: { parts: [{ text: " world" }] } }] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse([textFrame("Hello"), `data: ${last}`])),
    );

    const stream = await openGeminiStream("prompt");
    expect(await readAll(stream)).toBe("Hello world");
  });

  it("reassembles a frame split across two chunks", async () => {
    const frame = textFrame("split across chunks");
    const half = Math.floor(frame.length / 2);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse([frame.slice(0, half), frame.slice(half)])),
    );

    const stream = await openGeminiStream("prompt");
    expect(await readAll(stream)).toBe("split across chunks");
  });

  it("skips malformed frames without corrupting the rest of the stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([textFrame("before"), "data: {not json}\n\n", textFrame(" after")]),
      ),
    );

    const stream = await openGeminiStream("prompt");
    expect(await readAll(stream)).toBe("before after");
  });

  it("ignores the [DONE] sentinel and non-data lines", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse(["event: ping\n", textFrame("ok"), "data: [DONE]\n\n"])),
    );

    const stream = await openGeminiStream("prompt");
    expect(await readAll(stream)).toBe("ok");
  });

  it("surfaces an upstream failure as GeminiApiError before any bytes flow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("quota exceeded", { status: 429 })),
    );

    await expect(openGeminiStream("prompt")).rejects.toBeInstanceOf(GeminiApiError);
  });
});
