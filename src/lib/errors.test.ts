import { describe, it, expect, vi } from "vitest";
import {
  AppError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  safeActionMessage,
} from "@/lib/errors";

describe("safeActionMessage", () => {
  it("passes through the message of a known domain error", () => {
    expect(safeActionMessage(new ConflictError("Deal is not stale."), "Failed.")).toBe(
      "Deal is not stale.",
    );
    expect(safeActionMessage(new BadRequestError("Missing dealId."), "Failed.")).toBe(
      "Missing dealId.",
    );
    expect(safeActionMessage(new NotFoundError(), "Failed.")).toBe("Not found.");
  });

  it("subclasses of AppError are recognised", () => {
    class DealNotFoundError extends NotFoundError {
      constructor() {
        super("Deal not found");
      }
    }
    expect(safeActionMessage(new DealNotFoundError(), "Failed.")).toBe("Deal not found");
    expect(new DealNotFoundError()).toBeInstanceOf(AppError);
  });

  it("replaces an unexpected error with the fallback and reports the detail", () => {
    // Prisma messages leak schema internals, so they must never reach the UI.
    const err = new Error("Unique constraint failed on the fields: (`userId`,`gmailId`)");
    const onUnexpected = vi.fn();

    expect(safeActionMessage(err, "Could not save.")).toBe("Could not save.");
    safeActionMessage(err, "Could not save.", onUnexpected);

    expect(onUnexpected).toHaveBeenCalledTimes(1);
    expect(onUnexpected.mock.calls[0]?.[0]).toContain("Unique constraint failed");
  });

  it("handles a thrown non-Error value", () => {
    const onUnexpected = vi.fn();
    expect(safeActionMessage("boom", "Failed.", onUnexpected)).toBe("Failed.");
    expect(onUnexpected).toHaveBeenCalledWith("boom");
  });

  it("never returns the raw message of an unknown error", () => {
    const secret = "password=super-secret-value";
    expect(safeActionMessage(new Error(secret), "Failed.")).not.toContain("super-secret");
  });
});
