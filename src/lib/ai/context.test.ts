import { describe, it, expect } from "vitest";
import { formatEmails, truncate } from "@/lib/ai/context";

describe("AI context utilities", () => {
  describe("truncate", () => {
    it("returns empty string for null/undefined", () => {
      expect(truncate(null)).toBe("");
      expect(truncate(undefined)).toBe("");
    });

    it("truncates long text", () => {
      const longText = "a".repeat(1500);
      const result = truncate(longText, 1200);
      expect(result.length).toBe(1201); // 1200 + 1 for ellipsis
      expect(result.endsWith("…")).toBe(true);
    });
  });

  describe("formatEmails", () => {
    it("formats emails with direction and date", () => {
      const emails = [
        {
          subject: "Test subject",
          body: "Test body content",
          direction: "INBOUND",
          receivedAt: new Date("2024-01-15T10:30:00Z"),
        },
      ];
      const result = formatEmails(emails);
      expect(result).toContain("INBOUND");
      expect(result).toContain("2024-01-15");
      expect(result).toContain("Test subject");
      expect(result).toContain("Test body content");
    });

    it("limits to max emails", () => {
      const emails = Array.from({ length: 10 }, (_, i) => ({
        subject: `Subject ${i}`,
        body: `Body ${i}`,
        direction: "INBOUND",
        receivedAt: new Date(`2024-01-${15 + i}T10:30:00Z`),
      }));
      const result = formatEmails(emails, 3);
      const lines = result.split("\n\n");
      expect(lines.length).toBe(3);
    });

    it("returns empty string for empty array", () => {
      expect(formatEmails([])).toBe("");
    });

    it("truncates long email bodies", () => {
      const emails = [
        {
          subject: "Test",
          body: "a".repeat(1000),
          direction: "OUTBOUND",
          receivedAt: new Date("2024-01-15T10:30:00Z"),
        },
      ];
      const result = formatEmails(emails);
      expect(result.length).toBeLessThan(1000);
    });
  });
});