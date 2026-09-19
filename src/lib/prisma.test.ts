import { describe, it, expect, vi, beforeEach } from "vitest";

vi.unmock("@/lib/prisma");

const KEY = "prisma";

beforeEach(() => {
  vi.resetModules();
  delete (globalThis as unknown as Record<string, unknown>)[KEY];
  process.env["DATABASE_URL"] ??= "postgresql://test:test@localhost:5432/test";
});

describe("prisma client", () => {
  it("reuses one client across imports in production (serverless-safe)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const first = await import("@/lib/prisma");
      // Fresh module evaluation, same process globals = warm serverless reuse.
      vi.resetModules();
      const second = await import("@/lib/prisma");
      // Boolean compare: printing two PrismaClients overflows the reporter.
      expect(second.prisma === first.prisma).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      delete (globalThis as unknown as Record<string, unknown>)[KEY];
    }
  });
});
