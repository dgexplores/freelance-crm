import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, createLogger } from "@/lib/logger";

function getFirstCallArg(spy: ReturnType<typeof vi.spyOn>): string {
  const call = spy.mock.calls[0];
  if (!call || call.length === 0) throw new Error("Spy was not called");
  return call[0] as string;
}

describe("logger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("logs debug messages", () => {
    logger.debug("test message", { key: "value" });
    expect(consoleLogSpy).toHaveBeenCalled();
    const logged = JSON.parse(getFirstCallArg(consoleLogSpy));
    expect(logged.level).toBe("debug");
    expect(logged.message).toBe("test message");
    expect(logged.context).toEqual({ key: "value" });
  });

  it("logs info messages", () => {
    logger.info("info message");
    expect(consoleInfoSpy).toHaveBeenCalled();
    const logged = JSON.parse(getFirstCallArg(consoleInfoSpy));
    expect(logged.level).toBe("info");
  });

  it("logs warn messages", () => {
    logger.warn("warning message");
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("logs error messages", () => {
    logger.error("error message");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("includes timestamp", () => {
    logger.info("test");
    const logged = JSON.parse(getFirstCallArg(consoleInfoSpy));
    expect(logged.timestamp).toBeDefined();
    expect(new Date(logged.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("includes userId when provided", () => {
    logger.info("test", {}, "user-123");
    const logged = JSON.parse(getFirstCallArg(consoleInfoSpy));
    expect(logged.userId).toBe("user-123");
  });

  it("includes requestId when provided", () => {
    logger.info("test", {}, undefined, "req-456");
    const logged = JSON.parse(getFirstCallArg(consoleInfoSpy));
    expect(logged.requestId).toBe("req-456");
  });
});

describe("createLogger", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it("merges base context with call context", () => {
    const child = createLogger({ service: "test" });
    child.info("message", { action: "create" });
    const logged = JSON.parse(getFirstCallArg(consoleInfoSpy));
    expect(logged.context).toEqual({ service: "test", action: "create" });
  });

  it("binds userId and requestId", () => {
    const child = createLogger({}, "user-123", "req-456");
    child.info("message");
    const logged = JSON.parse(getFirstCallArg(consoleInfoSpy));
    expect(logged.userId).toBe("user-123");
    expect(logged.requestId).toBe("req-456");
  });
});