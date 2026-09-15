import { describe, it, expect } from "vitest";
import { parseFrom, truncate, decideBoundaryAdvance } from "@/lib/pipeline";
import type { ImportedMessage } from "@/lib/gmail";

describe("pipeline utilities", () => {
  describe("parseFrom", () => {
    it("parses 'Name <email@domain.com>' format", () => {
      const result = parseFrom('Jane Doe <jane@example.com>');
      expect(result).toEqual({ name: "Jane Doe", email: "jane@example.com" });
    });

    it("parses plain email address", () => {
      const result = parseFrom("jane@example.com");
      expect(result).toEqual({ name: null, email: "jane@example.com" });
    });

    it("handles empty string", () => {
      const result = parseFrom("");
      expect(result).toEqual({ name: null, email: null });
    });

    it("handles malformed input gracefully", () => {
      const result = parseFrom("not an email");
      expect(result).toEqual({ name: null, email: null });
    });

    it("lowercases email addresses", () => {
      const result = parseFrom('Jane Doe <JANE@EXAMPLE.COM>');
      expect(result.email).toBe("jane@example.com");
    });
  });

  describe("truncate", () => {
    it("returns string unchanged if under max length", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    it("truncates and adds ellipsis if over max length", () => {
      expect(truncate("hello world", 8)).toBe("hello...");
    });

    it("handles exact max length", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });

    it("trims whitespace before truncating", () => {
      expect(truncate("  hello world  ", 8)).toBe("hello...");
    });
  });
});

function msg(receivedAt: string, gmailId = receivedAt): ImportedMessage {
  return {
    gmailId,
    threadId: null,
    subject: "Website redesign",
    fromAddr: "jane@prospect.test",
    receivedAt: new Date(receivedAt),
    snippet: "snippet",
    body: "body",
  };
}

describe("decideBoundaryAdvance", () => {
  const NEWEST = "2026-09-10T12:00:00.000Z";
  const MIDDLE = "2026-09-05T12:00:00.000Z";
  const OLDEST = "2026-09-01T12:00:00.000Z";

  it("does not advance when any message failed to stage", () => {
    const decision = decideBoundaryAdvance([msg(NEWEST), msg(OLDEST)], false, 1);
    expect(decision).toEqual({ advance: false, reason: "errors" });
  });

  it("does not advance on an empty fetch, rather than jumping to now", () => {
    // Jumping to `now` here would skip mail that exists but was not returned,
    // e.g. during Gmail indexing lag.
    expect(decideBoundaryAdvance([], false, 0)).toEqual({
      advance: false,
      reason: "no-messages",
    });
  });

  it("advances to the newest message seen on a complete fetch", () => {
    const decision = decideBoundaryAdvance([msg(OLDEST), msg(NEWEST), msg(MIDDLE)], false, 0);
    expect(decision.advance).toBe(true);
    if (!decision.advance) throw new Error("expected advance");
    expect(decision.reason).toBe("complete");
    expect(decision.to.toISOString()).toBe(NEWEST);
  });

  it("advances only to the OLDEST message seen when the fetch was truncated", () => {
    // The bug this guards: advancing to the newest message after a truncated
    // fetch moved the boundary past mail that was never fetched, losing it
    // permanently and silently.
    const decision = decideBoundaryAdvance([msg(NEWEST), msg(MIDDLE), msg(OLDEST)], true, 0);
    expect(decision.advance).toBe(true);
    if (!decision.advance) throw new Error("expected advance");
    expect(decision.reason).toBe("truncated");
    expect(decision.to.toISOString()).toBe(OLDEST);
  });

  it("treats staging errors as more important than truncation", () => {
    // A failed window must be retried whole, so errors win.
    expect(decideBoundaryAdvance([msg(NEWEST)], true, 2)).toEqual({
      advance: false,
      reason: "errors",
    });
  });

  it("never returns a boundary derived from the clock", () => {
    const before = Date.now();
    const decision = decideBoundaryAdvance([msg(OLDEST)], false, 0);
    expect(decision.advance).toBe(true);
    if (!decision.advance) throw new Error("expected advance");
    expect(decision.to.getTime()).toBeLessThan(before);
  });
});