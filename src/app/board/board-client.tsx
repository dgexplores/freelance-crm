"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  async function move(to: (typeof STAGES)[number]) {
    setBusy(true);
    const res = await moveDealAction(deal.id, to);
    setBusy(false);
    setMsg(res.ok ? null : res.message);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {!isTerminal && index > 0 && (
        <button
          onClick={() => move(STAGES[index - 1])}
          disabled={busy}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40"
        >
          ← {STAGES[index - 1]}
        </button>
      )}
      {!isTerminal && index < STAGES.length - 2 && (
        <button
          onClick={() => move(STAGES[index + 1])}
          disabled={busy}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40"
        >
          {STAGES[index + 1]} →
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

function DealCard({ deal }: { deal: DealCard }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
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
      <p className="mt-2 text-xs leading-relaxed text-zinc-700">
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
      <MoveButtons deal={deal} />
    </div>
  );
}

export function BoardClient(props: {
  userEmail: string;
  gmailSyncStartedAt: string | null;
  factCount: number;
  deals: DealCard[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function importMail() {
    setBusy(true);
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
    deals: props.deals.filter((d) => d.stage === stage),
  }));

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Pipeline</h1>
            <p className="text-xs text-zinc-500">
              Signed in as {props.userEmail}
            </p>
          </div>
          <div className="flex items-center gap-3">
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
        <div className="mx-auto max-w-7xl px-6 pb-3">
          {status && (
            <p className="text-xs text-zinc-600">
              {status}
            </p>
          )}
          <p className="text-[11px] text-zinc-400">
            {props.gmailSyncStartedAt
              ? `Forward-only sync boundary: ${new Date(props.gmailSyncStartedAt).toLocaleString()} — only newer mail is imported.`
              : "No import run yet. First import reads at most the last day, then only newer mail."}
            {" · "}
            {props.factCount} facts recorded
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {columns.map(({ stage, deals }) => (
            <section key={stage} className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
                  {stage}
                </h2>
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600">
                  {deals.length}
                </span>
              </div>
              <p className="mb-2 text-[11px] text-zinc-400">
                {STAGE_NOTES[stage]}
              </p>
              <div className="flex flex-1 flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-100/60 p-2">
                {deals.length === 0 ? (
                  <p className="p-2 text-center text-xs text-zinc-400">
                    Empty
                  </p>
                ) : (
                  deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}