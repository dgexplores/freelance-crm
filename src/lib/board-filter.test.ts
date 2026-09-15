import { describe, it, expect } from "vitest";
import {
  DAY_MS,
  dealIdleDays,
  dealIsStale,
  filterDeals,
  matchesQuery,
  sortDeals,
  type FilterableDeal,
} from "@/lib/board-filter";

const NOW = Date.UTC(2026, 8, 15, 12, 0, 0);
const daysAgo = (n: number) => new Date(NOW - n * DAY_MS).toISOString();

function deal(overrides: Partial<FilterableDeal> = {}): FilterableDeal {
  return {
    title: "Untitled",
    stage: "INBOX",
    value: null,
    whyInPipeline: null,
    createdAt: daysAgo(30),
    contact: { name: null, email: "someone@example.com", lastContact: daysAgo(1) },
    latestEmail: null,
    ...overrides,
  };
}

describe("matchesQuery", () => {
  const subject = deal({
    title: "Acme retainer",
    whyInPipeline: "Asked for a quote on the dashboard rebuild",
    contact: { name: "Dana Reid", email: "dana@acme.test", lastContact: daysAgo(2) },
    latestEmail: {
      subject: "Re: dashboard scope",
      fromAddr: "dana@acme.test",
      receivedAt: daysAgo(2),
    },
  });

  it("matches on an empty query", () => {
    expect(matchesQuery(subject, "")).toBe(true);
    expect(matchesQuery(subject, "   ")).toBe(true);
  });

  it("matches the title, case-insensitively", () => {
    expect(matchesQuery(subject, "ACME")).toBe(true);
  });

  it("matches the contact name and email", () => {
    expect(matchesQuery(subject, "dana")).toBe(true);
    expect(matchesQuery(subject, "acme.test")).toBe(true);
  });

  it("matches the evidence text", () => {
    expect(matchesQuery(subject, "dashboard")).toBe(true);
  });

  it("matches the latest email subject and sender", () => {
    expect(matchesQuery(subject, "scope")).toBe(true);
  });

  it("matches the stage", () => {
    expect(matchesQuery(subject, "inbox")).toBe(true);
  });

  it("requires every token to match somewhere", () => {
    expect(matchesQuery(subject, "acme retainer")).toBe(true);
    expect(matchesQuery(subject, "acme invoice")).toBe(false);
  });

  it("does not match unrelated text", () => {
    expect(matchesQuery(subject, "zebra")).toBe(false);
  });
});

describe("dealIsStale / dealIdleDays", () => {
  it("flags an idle INBOX deal", () => {
    const d = deal({ contact: { name: null, email: "a@b.c", lastContact: daysAgo(8) } });
    expect(dealIsStale(d, NOW)).toBe(true);
    expect(dealIdleDays(d, NOW)).toBe(8);
  });

  it("does not flag a WON deal however old", () => {
    const d = deal({
      stage: "WON",
      contact: { name: null, email: "a@b.c", lastContact: daysAgo(90) },
    });
    expect(dealIsStale(d, NOW)).toBe(false);
  });
});

describe("filterDeals", () => {
  const deals = [
    deal({ title: "Alpha", stage: "INBOX", contact: { name: null, email: "a@x.com", lastContact: daysAgo(9) } }),
    deal({ title: "Beta", stage: "QUALIFIED", contact: { name: null, email: "b@x.com", lastContact: daysAgo(1) } }),
    deal({ title: "Gamma", stage: "WON", value: 5000, contact: { name: null, email: "c@x.com", lastContact: daysAgo(40) } }),
  ];

  it("returns everything for an empty filter set", () => {
    expect(filterDeals(deals, {}, NOW)).toHaveLength(3);
  });

  it("filters by stage", () => {
    expect(filterDeals(deals, { stage: "WON" }, NOW).map((d) => d.title)).toEqual(["Gamma"]);
  });

  it("filters by query", () => {
    expect(filterDeals(deals, { query: "beta" }, NOW).map((d) => d.title)).toEqual(["Beta"]);
  });

  it("filters to stale deals only", () => {
    // Alpha is stale (INBOX, 9d). Gamma is old but WON, so excluded.
    expect(filterDeals(deals, { staleOnly: true }, NOW).map((d) => d.title)).toEqual(["Alpha"]);
  });

  it("combines stage, query and stale filters", () => {
    expect(filterDeals(deals, { stage: "INBOX", staleOnly: true }, NOW).map((d) => d.title)).toEqual(["Alpha"]);
    expect(filterDeals(deals, { stage: "WON", staleOnly: true }, NOW)).toHaveLength(0);
  });
});

describe("sortDeals", () => {
  const deals = [
    deal({ title: "Old", contact: { name: null, email: "a@x.com", lastContact: daysAgo(20) } }),
    deal({ title: "Fresh", contact: { name: null, email: "b@x.com", lastContact: daysAgo(1) } }),
    deal({ title: "Mid", contact: { name: null, email: "c@x.com", lastContact: daysAgo(10) } }),
  ];

  it("sorts recent first by ascending idle time", () => {
    expect(sortDeals(deals, "recent", NOW).map((d) => d.title)).toEqual(["Fresh", "Mid", "Old"]);
  });

  it("sorts most idle first", () => {
    expect(sortDeals(deals, "idle", NOW).map((d) => d.title)).toEqual(["Old", "Mid", "Fresh"]);
  });

  it("sorts by value descending, unpriced last", () => {
    const priced = [
      deal({ title: "Small", value: 1000 }),
      deal({ title: "None", value: null }),
      deal({ title: "Big", value: 9000 }),
    ];
    expect(sortDeals(priced, "value", NOW).map((d) => d.title)).toEqual(["Big", "Small", "None"]);
  });

  it("does not mutate the input array", () => {
    const input = [...deals];
    sortDeals(input, "idle", NOW);
    expect(input.map((d) => d.title)).toEqual(["Old", "Fresh", "Mid"]);
  });
});
