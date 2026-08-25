/**
 * Fixed-window rate limiter.
 *
 * NOTE: in-memory, per server instance. Fine for a solo-user deployment on a
 * single instance; swap the storage for Upstash Redis (same interface) before
 * scaling to multiple instances/regions.
 */

export type RateLimitOptions = {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodic sweep so the map cannot grow unbounded with stale keys.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Throws RateLimitError when the caller exceeds `opts.limit` requests within
 * `opts.windowMs` for the given key. Cheap: call it on every request.
 */
export function rateLimit(key: string, opts: RateLimitOptions): void {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > opts.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new RateLimitError(
      `Too many requests. Try again in ${retryAfterSeconds}s.`,
      retryAfterSeconds,
    );
  }
}
