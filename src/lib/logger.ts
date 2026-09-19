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

// Keys whose values may carry PII (email addresses, subjects, bodies).
const PII_KEYS = new Set([
  "email",
  "senderemail",
  "contactemail",
  "subject",
  "body",
  "snippet",
  "fromaddr",
  "from",
]);

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return value.replace(EMAIL_RE, "[redacted-email]");
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PII_KEYS.has(k.toLowerCase()) ? "[redacted]" : redactValue(v);
    }
    return out;
  }
  return value;
}

function redactContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return context;
  return redactValue(context) as Record<string, unknown>;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>, userId?: string, requestId?: string) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: String(redactValue(message)),
    context: redactContext(context),
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