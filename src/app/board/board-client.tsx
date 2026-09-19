"use client";

import { useCallback, useEffect, useState } from "react";
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
import { moveDealAction, importGmailAction } from "@/app/board/actions";

type DealCard = {
  id: string;
  title: string;
  stage: string;
  whyInPipeline: string | null;
  value: number | null;
  wonAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact: { name: string | null; email: string; lastContact: string | null };
  latestEmail: {
    subject: string;
    fromAddr: string;
    receivedAt: string;
  } | null;
};

const STAGES = ["INBOX", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;

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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function MoveButtons({ deal }: { deal: DealCard }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const index = STAGES.indexOf(deal.stage as (typeof STAGES)[number]);
  const isTerminal = deal.stage === "WON" || deal.stage === "LOST";

  // Guard: if stage is not recognized, don't render move buttons
  if (index < 0) return null;

  // Extract adjacent stages for TypeScript narrowing; generic next/prev
  // never point at terminal stages (PROPOSAL uses Won/Lost buttons).
  const prevStage = index > 0 ? STAGES[index - 1] : null;
  const rawNext = index >= 0 && index + 1 < STAGES.length ? STAGES[index + 1] : null;
  const nextStage = rawNext === "WON" || rawNext === "LOST" ? null : rawNext;

  async function move(to: (typeof STAGES)[number]) {
    setBusy(true);
    try {
      const res = await moveDealAction(deal.id, to);
      setMsg(res.ok ? null : res.message);
    } catch {
      setMsg("Move failed.");
    } finally {
      setBusy(false);
    }
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

function CardFace({ deal }: { deal: DealCard }) {
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
      <p className="mt-0.5 text-[11px] text-zinc-400">
        Last contact: {fmtDate(deal.contact.lastContact)}
      </p>
    </div>
  );
}

/** Wraps a card with drag listeners. Click-through to the link still works:
 * PointerSensor needs 6px of movement before a drag activates. */
function DraggableDealCard({
  deal,
  index,
  disabled,
}: {
  deal: DealCard;
  index: number;
  disabled: boolean;
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
      className={`card-enter ${isDragging ? "z-20 opacity-60" : ""}`}
    >
      <Link
        href={`/board/${deal.id}`}
        className="block touch-none rounded-lg transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
      >
        <CardFace deal={deal} />
      </Link>
    </div>
  );
}

function Column({
  stage,
  count,
  children,
}: {
  stage: (typeof STAGES)[number];
  count: number;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `col:${stage}` });
  return (
    <section className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">{stage}</h2>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">
          {count}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-zinc-400">{STAGE_NOTES[stage]}</p>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-3 rounded-xl border p-2 transition-all duration-300 ${
          isOver
            ? "scale-[1.01] border-zinc-900 bg-zinc-200/80 shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
            : "border-zinc-200 bg-zinc-100/60"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

export function BoardClient(props: {
  userEmail: string;
  gmailSyncStartedAt: string | null;
  factCount: number;
  deals: DealCard[];
  staleCount: number;
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

  useEffect(() => {
    if (props.deals !== syncedFrom) {
      // Intentional prop sync: server sends fresh deals after router.refresh().
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSyncedFrom(props.deals);
      setDeals(props.deals);
    }
  }, [props.deals, syncedFrom]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // KeyboardSensor has no effect without a SortableContext; keyboard users
    // use the per-card MoveButtons instead.
    useSensor(KeyboardSensor),
  );

  const applyMove = useCallback(
    async (dealId: string, toStage: string) => {
      const current = deals.find((d) => d.id === dealId);
      if (!current || current.stage === toStage) return;

      const prevStage = current.stage;
      setMoving(true);
      setError(null);
      // Optimistic: move locally now, roll back on failure.
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage: toStage } : d)),
      );
      const revert = () =>
        setDeals((prev) =>
          prev.map((d) => (d.id === dealId ? { ...d, stage: prevStage } : d)),
        );
      try {
        const res = await moveDealAction(dealId, toStage);
        if (!res.ok) {
          revert();
          setError(res.message);
        }
      } catch {
        revert();
        setError("Move failed.");
      } finally {
        setMoving(false);
      }
    },
    [deals],
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const overId = event.over?.id;
    if (!overId || typeof overId !== "string") return;
    const activeDealId = String(event.active.id);
    let toStage: string;
    if (overId.startsWith("col:")) {
      toStage = overId.slice("col:".length);
    } else {
      // Dropped onto a card: resolve to that deal's stage; same card = no-op.
      const activeDeal = deals.find((d) => d.id === activeDealId);
      const overDeal = deals.find((d) => d.id === overId);
      if (!overDeal) {
        setError("Drop onto a column to move a deal.");
        return;
      }
      if (overDeal.id === activeDealId || (activeDeal && overDeal.stage === activeDeal.stage)) return;
      toStage = overDeal.stage;
    }
    if (!STAGES.includes(toStage as (typeof STAGES)[number])) {
      setError(`Unknown stage: ${toStage}.`);
      return;
    }
    void applyMove(activeDealId, toStage);
  }

  async function importMail() {
    setBusy(true);
    setError(null);
    const res = await importGmailAction();
    setBusy(false);
    setStatus(res.message);
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/");
  }

  const columns = STAGES.map((stage) => ({
    stage,
    deals: deals.filter((d) => d.stage === stage),
  }));

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-7xl px-6 pb-4 pt-20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Pipeline</h1>
            <p className="text-xs text-zinc-500">Signed in as {props.userEmail}</p>
          </div>
          <div className="flex items-center gap-3">
            {props.staleCount > 0 && (
              <span className="rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-xs font-medium">
                {props.staleCount} deal{props.staleCount !== 1 ? "s" : ""} need follow-up
              </span>
            )}
            <button
              onClick={importMail}
              disabled={busy}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
            >
              {busy ? "Importing…" : "Import Gmail"}
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
        <p className="text-[11px] text-zinc-400 mb-6">
          {props.gmailSyncStartedAt
            ? `Forward-only sync boundary: ${new Date(props.gmailSyncStartedAt).toLocaleString()} — only newer mail is imported.`
            : "No import run yet. First import reads at most the last day, then only newer mail."}
          {" · "}
          {props.factCount} facts recorded
        </p>
      </div>

      <main className="mx-auto max-w-7xl px-6 pb-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {columns.map(({ stage, deals: columnDeals }) => (
              <Column key={stage} stage={stage} count={columnDeals.length}>
                {columnDeals.length === 0 ? (
                  <p className="p-2 text-center text-xs text-zinc-400">
                    {activeDeal ? "Drop here" : "Empty"}
                  </p>
                ) : (
                  columnDeals.map((deal, i) => (
                    <div key={deal.id}>
                      <DraggableDealCard deal={deal} index={i} disabled={moving} />
                      {/* Keyboard/button fallback stays inside each card page */}
                      <div className="-mt-2 pl-1">
                        <MoveButtons deal={deal} />
                      </div>
                    </div>
                  ))
                )}
              </Column>
            ))}
          </div>
        </DndContext>
      </main>
    </div>
  );
}
