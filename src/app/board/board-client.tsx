"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { CSSProperties, ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import {
  SORT_KEYS,
  SORT_LABELS,
  dealIdleDays,
  dealIsStale,
  filterDeals,
  sortDeals,
  type FilterableDeal,
  type SortKey,
} from "@/lib/board-filter";
import {
  moveDealAction,
  importGmailAction,
  scheduleStaleFollowUpsAction,
} from "@/app/board/actions";

type DealCard = FilterableDeal & {
  id: string;
  wonAt: string | null;
  updatedAt: string;
};

const STAGES = ["INBOX", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;

/** Stages that are still in play — used for the "open pipeline" total. */
const OPEN_STAGES: readonly string[] = ["INBOX", "QUALIFIED", "PROPOSAL"];

const STAGE_NOTES: Record<(typeof STAGES)[number], string> = {
  INBOX: "New inbound contact",
  QUALIFIED: "Looks like real work",
  PROPOSAL: "Proposal sent",
  WON: "Closed",
  LOST: "Closed",
};

const STAGE_COLORS: Record<(typeof STAGES)[number], string> = {
  INBOX: "bg-zinc-100 text-zinc-700 border-zinc-200",
  QUALIFIED: "bg-sky-50 text-sky-700 border-sky-200",
  PROPOSAL: "bg-violet-50 text-violet-700 border-violet-200",
  WON: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOST: "bg-rose-50 text-rose-700 border-rose-200",
};

/**
 * Filter chips are styled from a lookup map of literal class strings, never
 * interpolated. Tailwind v4 scans source text for complete class names, so
 * `bg-${x}-600` compiles to nothing.
 */
const STAGE_CHIP_ACTIVE: Record<string, string> = {
  ALL: "border-zinc-900 bg-zinc-900 text-white",
  INBOX: "border-zinc-500 bg-zinc-700 text-white",
  QUALIFIED: "border-sky-600 bg-sky-600 text-white",
  PROPOSAL: "border-violet-600 bg-violet-600 text-white",
  WON: "border-emerald-600 bg-emerald-600 text-white",
  LOST: "border-rose-600 bg-rose-600 text-white",
};
const STAGE_CHIP_IDLE =
  "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Explicit locale so the server and client render identical strings. */
function fmtMoney(value: number | null): string {
  if (value === null) return "—";
  return `$${value.toLocaleString("en-US")}`;
}

function MoveButtons({ deal }: { deal: DealCard }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const index = STAGES.indexOf(deal.stage as (typeof STAGES)[number]);
  const isTerminal = deal.stage === "WON" || deal.stage === "LOST";

  // Guard: if stage is not recognized, don't render move buttons
  if (index < 0) return null;

  // Extract adjacent stages for TypeScript narrowing
  const prevStage = index > 0 ? STAGES[index - 1] : null;
  const nextStage = index < STAGES.length - 2 ? STAGES[index + 1] : null;

  async function move(to: (typeof STAGES)[number]) {
    setBusy(true);
    const res = await moveDealAction(deal.id, to);
    setBusy(false);
    setMsg(res.ok ? null : res.message);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {!isTerminal && prevStage && (
        <button
          onClick={() => move(prevStage)}
          disabled={busy}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40"
        >
          ← {prevStage}
        </button>
      )}
      {!isTerminal && nextStage && (
        <button
          onClick={() => move(nextStage)}
          disabled={busy}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40"
        >
          {nextStage} →
        </button>
      )}
      {deal.stage === "PROPOSAL" && (
        <>
          <button
            onClick={() => move("WON")}
            disabled={busy}
            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
          >
            Won
          </button>
          <button
            onClick={() => move("LOST")}
            disabled={busy}
            className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-40"
          >
            Lost
          </button>
        </>
      )}
      {isTerminal && (
        <button
          onClick={() => move("PROPOSAL")}
          disabled={busy}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40"
        >
          Reopen →
        </button>
      )}
      {msg && <span className="text-xs text-rose-600">{msg}</span>}
    </div>
  );
}

function CardFace({ deal, nowMs }: { deal: DealCard; nowMs: number }) {
  const stale = dealIsStale(deal, nowMs);
  const idle = dealIdleDays(deal, nowMs);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">{deal.title}</h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STAGE_COLORS[deal.stage as (typeof STAGES)[number]] ?? STAGE_COLORS.INBOX}`}
        >
          {deal.stage}
        </span>
      </div>
      <p className="text-xs text-zinc-600">
        {deal.contact.name ? `${deal.contact.name} · ` : ""}
        <span className="text-zinc-500">{deal.contact.email}</span>
      </p>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-700">
        {deal.whyInPipeline ?? "No evidence recorded."}
      </p>
      {deal.latestEmail && (
        <p className="mt-2 text-[11px] text-zinc-400">
          Last: {deal.latestEmail.subject} · {fmtDate(deal.latestEmail.receivedAt)}
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-zinc-400">
          Last contact: {fmtDate(deal.contact.lastContact)}
        </span>
        {deal.value !== null && (
          <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
            {fmtMoney(deal.value)}
          </span>
        )}
        {stale && (
          <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
            {idle}d idle
          </span>
        )}
      </div>
    </div>
  );
}

/** Wraps a card with drag listeners. Click-through to the link still works:
 * PointerSensor needs 6px of movement before a drag activates. */
function DraggableDealCard({
  deal,
  index,
  disabled,
  nowMs,
}: {
  deal: DealCard;
  index: number;
  disabled: boolean;
  nowMs: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled,
  });

  const style: CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ ...style, animationDelay: `${Math.min(index * 40, 320)}ms` }}
      className={`animate-fade-up ${isDragging ? "z-20 opacity-60" : ""}`}
    >
      <Link href={`/board/${deal.id}`} className="block touch-none">
        <CardFace deal={deal} nowMs={nowMs} />
      </Link>
    </div>
  );
}

function Column({
  stage,
  count,
  total,
  dragging,
  children,
}: {
  stage: (typeof STAGES)[number];
  count: number;
  total: number;
  dragging: boolean;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `col:${stage}` });
  const narrowed = count !== total;

  return (
    <section className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">{stage}</h2>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">
          {narrowed ? `${count}/${total}` : count}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-zinc-400">{STAGE_NOTES[stage]}</p>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-3 rounded-lg border p-2 transition-colors ${
          isOver
            ? "border-zinc-900 bg-zinc-200/80"
            : "border-zinc-200 bg-zinc-100/60"
        }`}
      >
        {children}
        {count === 0 && (
          <p className="p-2 text-center text-xs text-zinc-400">
            {dragging ? "Drop here" : narrowed ? "No matches" : "Empty"}
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-base font-semibold text-zinc-900">{value}</p>
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

export function BoardClient(props: {
  userEmail: string;
  gmailSyncStartedAt: string | null;
  factCount: number;
  deals: DealCard[];
  staleCount: number;
  /** Server clock, so SSR and hydration agree on staleness. */
  nowMs: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Local mirror of deals for optimistic drag moves; resynced from props
  // by adjusting state during render when the server sends fresh data.
  const [deals, setDeals] = useState(props.deals);
  const [syncedFrom, setSyncedFrom] = useState(props.deals);
  const [moving, setMoving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [staleOnly, setStaleOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  if (props.deals !== syncedFrom) {
    setSyncedFrom(props.deals);
    setDeals(props.deals);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const applyMove = useCallback(
    async (dealId: string, toStage: string) => {
      const current = deals.find((d) => d.id === dealId);
      if (!current || current.stage === toStage) return;

      setMoving(true);
      // Optimistic: move locally now.
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: toStage } : d)),
      );
      const res = await moveDealAction(dealId, toStage);
      if (!res.ok) {
        setError(res.message);
        router.refresh(); // snap back to server truth
      }
      setMoving(false);
    },
    [deals, router],
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const overId = event.over?.id;
    if (!overId || typeof overId !== "string") return;
    const toStage = overId.replace(/^col:/, "");
    if (!STAGES.includes(toStage as (typeof STAGES)[number])) return;
    void applyMove(String(event.active.id), toStage);
  }

  async function importMail() {
    setBusy(true);
    setError(null);
    setStatus(null);
    const res = await importGmailAction();
    setBusy(false);
    if (res.ok) setStatus(res.message);
    else setError(res.message);
  }

  async function scheduleFollowUps() {
    setBusy(true);
    setError(null);
    setStatus(null);
    const res = await scheduleStaleFollowUpsAction();
    setBusy(false);
    if (res.ok) {
      setStatus(res.message);
      router.refresh();
    } else {
      setError(res.message);
    }
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/");
  }

  const nowMs = props.nowMs;

  // Unfiltered totals for the metrics strip — the headline numbers should
  // describe the whole pipeline, not whatever the current filter happens to show.
  const metrics = useMemo(() => {
    let openValue = 0;
    let openCount = 0;
    let unpriced = 0;
    let wonValue = 0;
    let wonCount = 0;
    let lostCount = 0;

    for (const deal of deals) {
      if (deal.stage === "WON") {
        wonCount += 1;
        wonValue += deal.value ?? 0;
      } else if (deal.stage === "LOST") {
        lostCount += 1;
      } else if (OPEN_STAGES.includes(deal.stage)) {
        openCount += 1;
        openValue += deal.value ?? 0;
        if (deal.value === null) unpriced += 1;
      }
    }

    return { openValue, openCount, unpriced, wonValue, wonCount, lostCount };
  }, [deals]);

  const visible = useMemo(
    () =>
      sortDeals(
        filterDeals(deals, { query, stage: stageFilter, staleOnly }, nowMs),
        sortKey,
        nowMs,
      ),
    [deals, stageFilter, query, staleOnly, sortKey, nowMs],
  );

  const columns = STAGES.map((stage) => ({
    stage,
    all: deals.filter((d) => d.stage === stage).length,
    deals: visible.filter((d) => d.stage === stage),
  }));

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;
  const filtering = query.trim() !== "" || stageFilter !== "ALL" || staleOnly;
  const stageTabs = ["ALL", ...STAGES];

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Pipeline</h1>
            <p className="text-xs text-zinc-500">Signed in as {props.userEmail}</p>
          </div>
          <div className="flex items-center gap-3">
            {props.staleCount > 0 && (
              <button
                onClick={scheduleFollowUps}
                disabled={busy}
                title="Create follow-up tasks for deals idle 5+ days"
                className="rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-40"
              >
                {props.staleCount} deal{props.staleCount !== 1 ? "s" : ""} need follow-up — schedule
              </button>
            )}
            <button
              onClick={importMail}
              disabled={busy}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
            >
              {busy ? "Working…" : "Import Gmail"}
            </button>
            <button
              onClick={signOut}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Sign out
            </button>
          </div>
        </div>
        {(status || error) && (
          <p className={`mb-4 text-xs ${error ? "text-rose-600" : "text-zinc-600"}`}>
            {error ?? status}
          </p>
        )}

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Open pipeline"
            value={fmtMoney(metrics.openValue)}
            hint={`${metrics.openCount} deal${metrics.openCount !== 1 ? "s" : ""}${
              metrics.unpriced > 0 ? ` · ${metrics.unpriced} unpriced` : ""
            }`}
          />
          <Stat
            label="Won"
            value={fmtMoney(metrics.wonValue)}
            hint={`${metrics.wonCount} deal${metrics.wonCount !== 1 ? "s" : ""}`}
          />
          <Stat label="Lost" value={String(metrics.lostCount)} hint="closed out" />
          <Stat label="Facts" value={String(props.factCount)} hint="evidence recorded" />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals, contacts, evidence…"
            aria-label="Search deals"
            className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />

          <div className="flex flex-wrap items-center gap-1">
            {stageTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setStageFilter(tab)}
                aria-pressed={stageFilter === tab}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  stageFilter === tab
                    ? STAGE_CHIP_ACTIVE[tab] ?? STAGE_CHIP_ACTIVE.ALL
                    : STAGE_CHIP_IDLE
                }`}
              >
                {tab === "ALL" ? "All" : tab}
              </button>
            ))}
          </div>

          <button
            onClick={() => setStaleOnly((v) => !v)}
            aria-pressed={staleOnly}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              staleOnly
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            Needs follow-up ({props.staleCount})
          </button>

          <label className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
            Sort
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:border-zinc-500 focus:outline-none"
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          {filtering && (
            <button
              onClick={() => {
                setQuery("");
                setStageFilter("ALL");
                setStaleOnly(false);
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
            >
              Clear filters
            </button>
          )}
        </div>

        <p className="text-[11px] text-zinc-400 mb-6">
          {filtering
            ? `Showing ${visible.length} of ${deals.length} deals.`
            : `${deals.length} deal${deals.length !== 1 ? "s" : ""} in the pipeline.`}
          {" · "}
          {props.gmailSyncStartedAt
            ? `Forward-only sync boundary: ${new Date(props.gmailSyncStartedAt).toLocaleString()} — only newer mail is imported.`
            : "No import run yet. First import reads at most the last day, then only newer mail."}
        </p>
      </div>

      <main className="mx-auto max-w-7xl px-6 pb-6">
        {visible.length === 0 && deals.length > 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
            <p className="text-sm text-zinc-600">No deals match these filters.</p>
            <button
              onClick={() => {
                setQuery("");
                setStageFilter("ALL");
                setStaleOnly(false);
              }}
              className="mt-3 rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
              {columns.map(({ stage, all, deals: columnDeals }) => (
                <Column
                  key={stage}
                  stage={stage}
                  count={columnDeals.length}
                  total={all}
                  dragging={Boolean(activeDeal)}
                >
                  {columnDeals.map((deal, i) => (
                    <div key={deal.id}>
                      <DraggableDealCard
                        deal={deal}
                        index={i}
                        disabled={moving}
                        nowMs={nowMs}
                      />
                      {/* Keyboard/button fallback stays inside each card page */}
                      <div className="-mt-2 pl-1">
                        <MoveButtons deal={deal} />
                      </div>
                    </div>
                  ))}
                </Column>
              ))}
            </div>
          </DndContext>
        )}
      </main>
    </div>
  );
}
