/**
 * Single source of truth for "is this deal going quiet?".
 *
 * Deliberately free of any Prisma import so client components can call it. The
 * board's "needs follow-up" filter has to agree exactly with the server's
 * staleCount badge, and the way two copies of a rule disagree is that someone
 * changes one of them.
 *
 * The stage lists are plain `readonly string[]` rather than `DealStage[]` so
 * this module never pulls `@prisma/client` into a browser bundle.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Deals idle at least this many days are considered to need a nudge. */
export const DEFAULT_STALE_DAYS = 5;

/** Stages a follow-up nudge applies to — the ball is in their court. */
export const NUDGE_STAGES: readonly string[] = ["INBOX", "QUALIFIED"];

export interface ActivitySignals {
  /** When the deal record was created. Acts as a floor. */
  createdAt: Date | string;
  /** `Contact.lastContact`, if known. */
  lastContact: Date | string | null;
  /** Newest email on the thread, if any. */
  latestEmailAt: Date | string | null;
}

function toMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * The most recent real activity on a deal: the later of the contact's
 * lastContact and the newest email, never earlier than the deal's creation.
 *
 * Deal metadata edits (`updatedAt`) deliberately do NOT count — renaming a deal
 * is not the prospect doing anything, and treating it as activity would hide
 * exactly the deals that need chasing.
 */
export function lastActivityAt(signals: ActivitySignals): Date {
  const candidates: number[] = [];
  if (signals.lastContact) candidates.push(toMs(signals.lastContact));
  if (signals.latestEmailAt) candidates.push(toMs(signals.latestEmailAt));

  const floor = toMs(signals.createdAt);
  const latest = candidates.length ? Math.max(...candidates) : floor;
  return new Date(Math.max(latest, floor));
}

/** Has this moment in time aged past the cutoff? */
export function isIdleFor(
  lastActivity: Date | string,
  days: number = DEFAULT_STALE_DAYS,
  now: number = Date.now(),
): boolean {
  return toMs(lastActivity) < now - days * DAY_MS;
}

/** Whole days elapsed since a moment, floored at zero. */
export function idleDaysSince(
  lastActivity: Date | string,
  now: number = Date.now(),
): number {
  return Math.max(0, Math.floor((now - toMs(lastActivity)) / DAY_MS));
}

export function idleDays(
  signals: ActivitySignals,
  now: number = Date.now(),
): number {
  return idleDaysSince(lastActivityAt(signals), now);
}

/** True when the deal is still open-ended and nothing has happened for `days`. */
export function isStale(
  stage: string,
  signals: ActivitySignals,
  days: number = DEFAULT_STALE_DAYS,
  stages: readonly string[] = NUDGE_STAGES,
  now: number = Date.now(),
): boolean {
  if (!stages.includes(stage)) return false;
  return isIdleFor(lastActivityAt(signals), days, now);
}
