const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 300;
const DEFAULT_MAX_DELAY_MS = 3000;

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return true to retry this error. Required so callers opt in deliberately. */
  retryOn: (err: unknown) => boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry an async operation with exponential backoff + jitter.
 * Only retries errors the caller's `retryOn` predicate accepts.
 * Throws the last error when attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? DEFAULT_ATTEMPTS);
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !opts.retryOn(err)) throw err;
      const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const jitter = backoff / 2 + Math.random() * (backoff / 2);
      await sleep(jitter);
    }
  }
  // Unreachable: loop either returns or throws.
  throw lastErr;
}

/** Network-layer failures surface as TypeError from fetch. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && err.message.includes("fetch");
}
