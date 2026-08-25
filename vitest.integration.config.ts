import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Integration tests hit a real PostgreSQL database.
 * Run with: npm run test:int   (skips gracefully when DB unreachable)
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next.js internal marker — irrelevant under Node env, aliased anyway.
      "server-only": path.resolve(__dirname, "./test/mocks/server-only.ts"),
    },
  },
});
