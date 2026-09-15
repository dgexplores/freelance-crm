import { describe, it, expect } from "vitest";
import {
  DAY_MS,
  DEFAULT_STALE_DAYS,
  NUDGE_STAGES,
  idleDays,
  idleDaysSince,
  isIdleFor,
  isStale,
  lastActivityAt,
} from "@/lib/staleness";

// Fixed clock — the rule is time-dependent, so tests must not depend on
// whenever the suite happens to run.
const NOW = Date.UTC(2026, 8, 15, 12, 0, 0);
const daysAgo = (n: number) => new Date(NOW - n * DAY_MS).toISOString();

describe("lastActivityAt", () => {
  it("takes the newest of lastContact and the latest email", () => {
    const result = lastActivityAt({
      createdAt: daysAgo(90),
      lastContact: daysAgo(10),
      latestEmailAt: daysAgo(3),
    });
    expect(result.toISOString()).toBe(daysAgo(3));
  });

  it("uses lastContact when it is newer than the mail", () => {
    const result = lastActivityAt({
      createdAt: daysAgo(90),
      lastContact: daysAgo(2),
      latestEmailAt: daysAgo(8),
    });
    expect(result.toISOString()).toBe(daysAgo(2));
  });

  it("falls back to createdAt when there is neither contact nor mail", () => {
    const result = lastActivityAt({
      createdAt: daysAgo(4),
      lastContact: null,
      latestEmailAt: null,
    });
    expect(result.toISOString()).toBe(daysAgo(4));
  });

  it("never reports earlier than createdAt", () => {
    // A stale lastContact predating the deal should not make it look older
    // than the deal itself.
    const result = lastActivityAt({
      createdAt: daysAgo(5),
      lastContact: daysAgo(400),
      latestEmailAt: null,
    });
    expect(result.toISOString()).toBe(daysAgo(5));
  });

  it("accepts Date objects as well as ISO strings", () => {
    const result = lastActivityAt({
      createdAt: new Date(NOW - 90 * DAY_MS),
      lastContact: new Date(NOW - 2 * DAY_MS),
      latestEmailAt: null,
    });
    expect(result.getTime()).toBe(NOW - 2 * DAY_MS);
  });
});

describe("isIdleFor / idleDaysSince", () => {
  it("treats exactly `days` old as NOT yet idle", () => {
    expect(isIdleFor(daysAgo(5), 5, NOW)).toBe(false);
  });

  it("treats a millisecond past the cutoff as idle", () => {
    expect(isIdleFor(new Date(NOW - 5 * DAY_MS - 1), 5, NOW)).toBe(true);
  });

  it("floors elapsed days and never goes negative", () => {
    expect(idleDaysSince(daysAgo(7.9), NOW)).toBe(7);
    // Future timestamps clamp to zero rather than reporting negative idleness.
    expect(idleDaysSince(new Date(NOW + 3 * DAY_MS), NOW)).toBe(0);
  });
});

describe("isStale", () => {
  const base = { createdAt: daysAgo(30), lastContact: null, latestEmailAt: null };

  it("flags an INBOX deal idle past the threshold", () => {
    expect(isStale("INBOX", { ...base, lastContact: daysAgo(6) }, DEFAULT_STALE_DAYS, NUDGE_STAGES, NOW)).toBe(true);
  });

  it("does not flag an INBOX deal inside the threshold", () => {
    expect(isStale("INBOX", { ...base, lastContact: daysAgo(4) }, DEFAULT_STALE_DAYS, NUDGE_STAGES, NOW)).toBe(false);
  });

  it("ignores stages outside the nudge set", () => {
    for (const stage of ["PROPOSAL", "WON", "LOST"]) {
      expect(isStale(stage, { ...base, lastContact: daysAgo(60) }, DEFAULT_STALE_DAYS, NUDGE_STAGES, NOW)).toBe(false);
    }
  });

  it("flags QUALIFIED as well as INBOX", () => {
    expect(isStale("QUALIFIED", { ...base, lastContact: daysAgo(9) }, DEFAULT_STALE_DAYS, NUDGE_STAGES, NOW)).toBe(true);
  });

  it("agrees with idleDays at the boundary", () => {
    const signals = { ...base, lastContact: daysAgo(5) };
    // Exactly 5 idle days is not yet stale — the cutoff is exclusive.
    expect(idleDays(signals, NOW)).toBe(5);
    expect(isStale("INBOX", signals, DEFAULT_STALE_DAYS, NUDGE_STAGES, NOW)).toBe(false);
  });
});
