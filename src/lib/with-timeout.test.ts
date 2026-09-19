import { describe, it, expect } from "vitest";
import { withTimeout, TimeoutError } from "@/lib/with-timeout";

describe("withTimeout", () => {
  it("resolves when the operation finishes in time", async () => {
    const result = await withTimeout(Promise.resolve("ok"), {
      ms: 1000,
      label: "fast",
    });
    expect(result).toBe("ok");
  });

  it("rejects with TimeoutError when the operation hangs", async () => {
    const hanging = new Promise<string>(() => {});
    await expect(
      withTimeout(hanging, { ms: 20, label: "board-data" }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it("names the hanging operation in the error message", async () => {
    const hanging = new Promise<string>(() => {});
    const err = await withTimeout(hanging, {
      ms: 20,
      label: "board-data",
    }).catch((e) => e);
    expect((err as Error).message).toContain("board-data");
  });

  it("passes through the operation's own rejection, not a timeout", async () => {
    const failing = Promise.reject(new Error("db down"));
    await expect(
      withTimeout(failing, { ms: 1000, label: "board-data" }),
    ).rejects.toThrow("db down");
  });
});
