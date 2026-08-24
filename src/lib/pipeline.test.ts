import { describe, it, expect } from "vitest";
import { parseFrom, truncate } from "@/lib/pipeline";

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