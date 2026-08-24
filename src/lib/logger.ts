/**
 * Structured logging utility for production observability.
 * Logs as JSON to stdout for ingestion by log aggregation systems.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  userId?: string;
  requestId?: string;
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    userId,
    requestId,
  };
  // In production, this goes to stdout/stderr for log aggregation
  console[level === "debug" ? "log" : level](formatEntry(entry));
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) =>
    log("debug", message, context, userId, requestId),
  info: (message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) =>
    log("info", message, context, userId, requestId),
  warn: (message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) =>
    log("warn", message, context, userId, requestId),
  error: (message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) =>
    log("error", message, context, userId, requestId),
};

/**
 * Create a child logger with bound context.
 */
export function createLogger(baseContext: Record<string, unknown>, userId?: string, requestId?: string) {
  return {
    debug: (message: string, context?: Record<string, unknown>) =>
      logger.debug(message, { ...baseContext, ...context }, userId, requestId),
    info: (message: string, context?: Record<string, unknown>) =>
      logger.info(message, { ...baseContext, ...context }, userId, requestId),
    warn: (message: string, context?: Record<string, unknown>) =>
      logger.warn(message, { ...baseContext, ...context }, userId, requestId),
    error: (message: string, context?: Record<string, unknown>) =>
      logger.error(message, { ...baseContext, ...context }, userId, requestId),
  };
}