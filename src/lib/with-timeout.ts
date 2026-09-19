/** Thrown when an operation exceeds its deadline. */
export class TimeoutError extends Error {
  constructor(public readonly label: string, ms: number) {
    super(`${label} timed out after ${ms}ms.`);
    this.name = "TimeoutError";
  }
}

/**
 * Race a promise against a deadline. The loser of the race still settles in
 * the background; only the caller's wait is bounded, so a hung DB query
 * fails fast to the nearest error boundary instead of holding Suspense open
 * until the platform closes the connection (React #412).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  opts: { ms: number; label: string },
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(opts.label, opts.ms)), opts.ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
