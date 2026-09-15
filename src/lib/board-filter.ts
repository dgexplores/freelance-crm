import { DEFAULT_STALE_DAYS, NUDGE_STAGES, idleDays, isStale } from "@/lib/staleness";

/**
 * Board filtering and sorting.
 *
 * Extracted from the board component so the behaviour is unit-testable without
 * rendering React, and so the component stays presentational.
 */

export type SortKey = "recent" | "value" | "idle";

export const SORT_KEYS: readonly SortKey[] = ["recent", "value", "idle"];

export const SORT_LABELS: Record<SortKey, string> = {
  recent: "Recent activity",
  value: "Deal value",
  idle: "Most idle",
};

/** The subset of a deal the board filters on. */
export interface FilterableDeal {
  title: string;
  stage: string;
  value: number | null;
  whyInPipeline: string | null;
  createdAt: string;
  contact: { name: string | null; email: string; lastContact: string | null };
  latestEmail: { subject: string; fromAddr: string; receivedAt: string } | null;
}

export function signalsOf(deal: FilterableDeal) {
  return {
    createdAt: deal.createdAt,
    lastContact: deal.contact.lastContact,
    latestEmailAt: deal.latestEmail?.receivedAt ?? null,
  };
}

export function dealIsStale(deal: FilterableDeal, nowMs: number): boolean {
  return isStale(deal.stage, signalsOf(deal), DEFAULT_STALE_DAYS, NUDGE_STAGES, nowMs);
}

export function dealIdleDays(deal: FilterableDeal, nowMs: number): number {
  return idleDays(signalsOf(deal), nowMs);
}

/**
 * Every whitespace-separated token must appear somewhere on the card, so
 * "acme retainer" narrows the result set rather than widening it.
 */
export function matchesQuery(deal: FilterableDeal, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = [
    deal.title,
    deal.contact.name ?? "",
    deal.contact.email,
    deal.whyInPipeline ?? "",
    deal.latestEmail?.subject ?? "",
    deal.latestEmail?.fromAddr ?? "",
    deal.stage,
  ]
    .join(" \u0000 ")
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

export interface DealFilters {
  query?: string;
  /** A stage name, or "ALL". */
  stage?: string;
  staleOnly?: boolean;
}

export function filterDeals<T extends FilterableDeal>(
  deals: readonly T[],
  filters: DealFilters,
  nowMs: number,
): T[] {
  const query = filters.query ?? "";
  const stage = filters.stage ?? "ALL";

  return deals.filter((deal) => {
    if (stage !== "ALL" && deal.stage !== stage) return false;
    if (!matchesQuery(deal, query)) return false;
    if (filters.staleOnly && !dealIsStale(deal, nowMs)) return false;
    return true;
  });
}

export function sortDeals<T extends FilterableDeal>(
  deals: readonly T[],
  sortKey: SortKey,
  nowMs: number,
): T[] {
  return [...deals].sort((a, b) => {
    if (sortKey === "value") {
      // Unpriced deals sort last rather than being treated as zero — most
      // deals have no value, and letting them cluster at the top would bury
      // the ones that do.
      if (a.value === null && b.value === null) {
        return dealIdleDays(b, nowMs) - dealIdleDays(a, nowMs);
      }
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return b.value - a.value;
    }
    if (sortKey === "idle") {
      return dealIdleDays(b, nowMs) - dealIdleDays(a, nowMs);
    }
    // recent: most recently active first
    return dealIdleDays(a, nowMs) - dealIdleDays(b, nowMs);
  });
}
