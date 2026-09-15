"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  updateDealAction,
  updateContactAction,
  setFactAppliedAction,
} from "@/app/board/actions";
import {
  createTaskAction,
  completeTaskAction,
  reopenTaskAction,
  deleteTaskAction,
  TASK_KINDS,
  type TaskKind,
} from "./task-actions";

type Deal = {
  id: string;
  title: string;
  stage: string;
  whyInPipeline: string | null;
  value: number | null;
  wonAt: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
  contact: {
    id: string;
    name: string | null;
    email: string;
    company: string | null;
    linkedinUrl: string | null;
    source: string | null;
    lastContact: string | null;
    emails: Array<{
      id: string;
      subject: string;
      body: string;
      direction: string;
      receivedAt: string;
      gmailId: string | null;
      threadId: string | null;
    }>;
    facts: Array<{
      id: string;
      claim: string;
      source: string;
      strength: string;
      applied: boolean;
      createdAt: string;
    }>;
  };
  tasks: Array<{
    id: string;
    kind: string;
    dueAt: string;
    reason: string;
    done: boolean;
    doneAt: string | null;
    createdAt: string;
  }>;
};

const STAGE_LABELS: Record<string, string> = {
  INBOX: "New inbound",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal sent",
  WON: "Won",
  LOST: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  INBOX: "bg-zinc-100 text-zinc-700 border-zinc-200",
  QUALIFIED: "bg-sky-50 text-sky-700 border-sky-200",
  PROPOSAL: "bg-violet-50 text-violet-700 border-violet-200",
  WON: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOST: "bg-rose-50 text-rose-700 border-rose-200",
};

// Tailwind's scanner is static: it only generates classes it can find as
// literal strings. A template like `bg-${x}-50` is never emitted, so the badge
// rendered unstyled. Keep every variant written out in full.
const DIRECTION_COLORS: Record<string, string> = {
  INBOUND: "bg-sky-50 text-sky-700",
  OUTBOUND: "bg-violet-50 text-violet-700",
};
const DIRECTION_COLOR_FALLBACK = "bg-zinc-100 text-zinc-700";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** yyyy-mm-dd for <input type="date">, in the viewer's local time. */
function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tomorrowAsInputValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateInputValue(d);
}

/** Small shared input styling so the edit forms stay visually consistent. */
const INPUT_CLASS =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-40";
const PRIMARY_BUTTON_CLASS =
  "rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40";

/**
 * POST to a streaming AI endpoint and forward plain-text chunks as they
 * arrive. Non-OK responses are JSON errors — parse and surface them.
 */
async function streamGeneration(
  endpoint: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming is not supported in this browser.");
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) onChunk(chunk);
  }
}

export function DealDetailClient(props: {
  deal: Deal;
  userName: string;
  userEmail: string;
  hasRateCard: boolean;
}) {
  const { deal } = props;

  const [activeTab, setActiveTab] = useState<"overview" | "emails" | "facts" | "tasks">("overview");
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [proposal, setProposal] = useState<string | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Deal / contact editing. The importer only ever infers these fields, so
  // without a manual path `value` stays null forever and the AI prompts keep
  // reading "Estimated value: unknown".
  const [editingDeal, setEditingDeal] = useState(false);
  const [dealTitle, setDealTitle] = useState(deal.title);
  const [dealValue, setDealValue] = useState(deal.value === null ? "" : String(deal.value));
  const [lostReason, setLostReason] = useState(deal.lostReason ?? "");

  const [editingContact, setEditingContact] = useState(false);
  const [contactName, setContactName] = useState(deal.contact.name ?? "");
  const [contactCompany, setContactCompany] = useState(deal.contact.company ?? "");
  const [contactLinkedin, setContactLinkedin] = useState(deal.contact.linkedinUrl ?? "");

  // New-task form.
  const [taskKind, setTaskKind] = useState<TaskKind>("follow_up");
  const [taskDue, setTaskDue] = useState(tomorrowAsInputValue);
  const [taskReason, setTaskReason] = useState("");

  /**
   * Run a server action, surface its message, and refresh the server data so
   * the page reflects the write without a manual reload.
   */
  async function run(
    fn: () => Promise<{ ok: boolean; message: string }>,
    opts: { refresh?: boolean; successIsNotice?: boolean } = {},
  ): Promise<boolean> {
    const { refresh = true, successIsNotice = false } = opts;
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res.ok) {
        if (successIsNotice) {
          setNotice(res.message);
          setTimeout(() => setNotice(null), 2500);
        }
        if (refresh) router.refresh();
        return true;
      }
      setError(res.message);
      return false;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveDeal() {
    const parsed = dealValue.trim() === "" ? null : Number(dealValue);
    if (parsed !== null && !Number.isFinite(parsed)) {
      setError("Estimated value must be a number.");
      return;
    }
    const ok = await run(
      () =>
        updateDealAction(deal.id, {
          title: dealTitle,
          value: parsed,
          ...(deal.stage === "LOST" ? { lostReason } : {}),
        }),
      { successIsNotice: true },
    );
    if (ok) setEditingDeal(false);
  }

  async function saveContact() {
    const ok = await run(
      () =>
        updateContactAction(deal.contact.id, {
          name: contactName,
          company: contactCompany,
          linkedinUrl: contactLinkedin,
        }),
      { successIsNotice: true },
    );
    if (ok) setEditingContact(false);
  }

  async function addTask() {
    const due = new Date(`${taskDue}T09:00:00`);
    if (Number.isNaN(due.getTime())) {
      setError("Pick a valid due date.");
      return;
    }
    const ok = await run(
      () => createTaskAction(deal.id, taskKind, due, taskReason),
      { successIsNotice: true },
    );
    if (ok) {
      setTaskReason("");
      setTaskDue(tomorrowAsInputValue());
    }
  }

  async function handleGenerateBrief() {
    if (!props.hasRateCard) {
      setError("Add a rate card in Settings to generate briefs.");
      return;
    }
    setBriefLoading(true);
    setError(null);
    setBrief(null);
    try {
      await streamGeneration("/api/ai/brief", { dealId: deal.id }, (chunk) =>
        setBrief((prev) => (prev ?? "") + chunk),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate brief");
    } finally {
      setBriefLoading(false);
    }
  }

  async function handleGenerateProposal() {
    if (!props.hasRateCard) {
      setError("Add a rate card in Settings to generate proposals.");
      return;
    }
    if (deal.stage !== "PROPOSAL") {
      setError(`Deal is in ${deal.stage} stage. Proposals only for PROPOSAL stage.`);
      return;
    }
    setProposalLoading(true);
    setError(null);
    setProposal(null);
    try {
      await streamGeneration("/api/ai/proposal", { dealId: deal.id }, (chunk) =>
        setProposal((prev) => (prev ?? "") + chunk),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate proposal");
    } finally {
      setProposalLoading(false);
    }
  }

  async function handleGenerateNudge() {
    if (!props.hasRateCard) {
      setError("Add a rate card in Settings to generate nudges.");
      return;
    }
    if (deal.stage === "WON" || deal.stage === "LOST") {
      setError("Cannot nudge a closed deal.");
      return;
    }
    setNudgeLoading(true);
    setError(null);
    setNudge(null);
    try {
      await streamGeneration("/api/ai/nudge", { dealId: deal.id }, (chunk) =>
        setNudge((prev) => (prev ?? "") + chunk),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate nudge");
    } finally {
      setNudgeLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setNotice("Copied to clipboard.");
        setTimeout(() => setNotice(null), 2000);
      },
      () => setError("Could not copy — your browser blocked clipboard access."),
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/board" className="text-zinc-500 hover:text-zinc-700">
              ← Back
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">{deal.title}</h1>
              <p className="text-xs text-zinc-500">{props.userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[deal.stage as keyof typeof STAGE_COLORS] ?? STAGE_COLORS["INBOX"]}`}>
              {deal.stage}
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-3 border-b border-zinc-200">
          <nav className="flex gap-1 overflow-x-auto">
            {[
              { id: "overview", label: "Overview" },
              { id: "emails", label: "Emails", count: deal.contact.emails.length },
              { id: "facts", label: "Facts", count: deal.contact.facts.length },
              { id: "tasks", label: "Tasks", count: deal.tasks.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-white text-zinc-900 border-b-2 border-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {tab.label} {tab.count !== undefined && <span className="ml-1 text-xs text-zinc-400">({tab.count})</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {notice && (
          <div className="mb-6 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">×</button>
          </div>
        )}

        {activeTab === "overview" && (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              <section className="rounded-lg border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">Deal Details</h2>
                  {editingDeal ? (
                    <div className="flex gap-2">
                      <button onClick={() => setEditingDeal(false)} disabled={busy} className={SECONDARY_BUTTON_CLASS}>
                        Cancel
                      </button>
                      <button onClick={saveDeal} disabled={busy} className={PRIMARY_BUTTON_CLASS}>
                        {busy ? "Saving…" : "Save"}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingDeal(true)} disabled={busy} className={SECONDARY_BUTTON_CLASS}>
                      Edit
                    </button>
                  )}
                </div>

                {editingDeal ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm text-zinc-500">
                      Title
                      <input
                        value={dealTitle}
                        onChange={(e) => setDealTitle(e.target.value)}
                        className={`mt-1 ${INPUT_CLASS}`}
                        maxLength={200}
                      />
                    </label>
                    <label className="text-sm text-zinc-500">
                      Estimated value (USD)
                      <input
                        value={dealValue}
                        onChange={(e) => setDealValue(e.target.value)}
                        inputMode="numeric"
                        placeholder="Leave blank if unknown"
                        className={`mt-1 ${INPUT_CLASS}`}
                      />
                    </label>
                    {deal.stage === "LOST" && (
                      <label className="text-sm text-zinc-500 sm:col-span-2">
                        Lost reason
                        <input
                          value={lostReason}
                          onChange={(e) => setLostReason(e.target.value)}
                          className={`mt-1 ${INPUT_CLASS}`}
                          maxLength={500}
                        />
                      </label>
                    )}
                    <p className="text-xs text-zinc-400 sm:col-span-2">
                      Stage is changed from the board, not here.
                    </p>
                  </div>
                ) : (
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <dt className="text-sm text-zinc-500">Stage</dt>
                    <dd className="text-sm font-medium text-zinc-900">{STAGE_LABELS[deal.stage] ?? deal.stage}</dd>
                    <dt className="text-sm text-zinc-500">Estimated Value</dt>
                    <dd className="text-sm font-medium text-zinc-900">{deal.value ? `$${deal.value.toLocaleString()}` : "Not set"}</dd>
                    <dt className="text-sm text-zinc-500">Created</dt>
                    <dd className="text-sm text-zinc-700">{fmtDate(deal.createdAt)}</dd>
                    <dt className="text-sm text-zinc-500">Updated</dt>
                    <dd className="text-sm text-zinc-700">{fmtDate(deal.updatedAt)}</dd>
                    {deal.wonAt && (
                      <>
                        <dt className="text-sm text-zinc-500">Won At</dt>
                        <dd className="text-sm text-zinc-700">{fmtDate(deal.wonAt)}</dd>
                      </>
                    )}
                    {deal.lostReason && (
                      <>
                        <dt className="text-sm text-zinc-500">Lost Reason</dt>
                        <dd className="text-sm text-zinc-700">{deal.lostReason}</dd>
                      </>
                    )}
                  </dl>
                )}
              </section>

              <section className="rounded-lg border border-zinc-200 bg-white p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 mb-4">Evidence: Why in Pipeline</h2>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">{deal.whyInPipeline ?? "No evidence recorded."}</p>
              </section>

              {(brief !== null || briefLoading) && (
                <section className="animate-fade-up rounded-lg border border-zinc-200 bg-white p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">Pre-Call Brief</h2>
                    {!briefLoading && brief && (
                      <button onClick={() => copyToClipboard(brief)} className="text-xs text-zinc-500 hover:text-zinc-700">Copy</button>
                    )}
                  </div>
                  {briefLoading && brief === null ? (
                    <div className="space-y-2" aria-busy="true">
                      <div className="ai-shimmer h-3 w-3/4 rounded" />
                      <div className="ai-shimmer h-3 w-full rounded" />
                      <div className="ai-shimmer h-3 w-5/6 rounded" />
                    </div>
                  ) : (
                    <div className={`prose prose-sm max-w-none whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-zinc-700${briefLoading ? " ai-caret" : ""}`}>
                      {brief}
                    </div>
                  )}
                </section>
              )}

              {(proposal !== null || proposalLoading) && (
                <section className="animate-fade-up rounded-lg border border-zinc-200 bg-white p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">Proposal Draft</h2>
                    {!proposalLoading && proposal && (
                      <button onClick={() => copyToClipboard(proposal)} className="text-xs text-zinc-500 hover:text-zinc-700">Copy</button>
                    )}
                  </div>
                  {proposalLoading && proposal === null ? (
                    <div className="space-y-2" aria-busy="true">
                      <div className="ai-shimmer h-3 w-2/3 rounded" />
                      <div className="ai-shimmer h-3 w-full rounded" />
                      <div className="ai-shimmer h-3 w-4/5 rounded" />
                    </div>
                  ) : (
                    <div className={`prose prose-sm max-w-none whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-zinc-700${proposalLoading ? " ai-caret" : ""}`}>
                      {proposal}
                    </div>
                  )}
                </section>
              )}

              {(nudge !== null || nudgeLoading) && (
                <section className="animate-fade-up rounded-lg border border-zinc-200 bg-white p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">Follow-Up Nudge</h2>
                    {!nudgeLoading && nudge && (
                      <button onClick={() => copyToClipboard(nudge)} className="text-xs text-zinc-500 hover:text-zinc-700">Copy</button>
                    )}
                  </div>
                  {nudgeLoading && nudge === null ? (
                    <div className="space-y-2" aria-busy="true">
                      <div className="ai-shimmer h-3 w-1/2 rounded" />
                      <div className="ai-shimmer h-3 w-11/12 rounded" />
                    </div>
                  ) : (
                    <div className={`prose prose-sm max-w-none whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-zinc-700${nudgeLoading ? " ai-caret" : ""}`}>
                      {nudge}
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="space-y-6">
              <section className="rounded-lg border border-zinc-200 bg-white p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 mb-4">AI Actions</h2>
                <div className="space-y-3">
                  <button
                    onClick={handleGenerateBrief}
                    disabled={briefLoading || !props.hasRateCard}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-left hover:bg-zinc-50 disabled:opacity-40"
                  >
                    <div className="font-medium text-zinc-900">Generate Pre-Call Brief</div>
                    <div className="text-xs text-zinc-500">Who they are, what they said, what to confirm</div>
                    {briefLoading && <div className="text-xs text-zinc-400">Generating…</div>}
                  </button>
                  <button
                    onClick={handleGenerateProposal}
                    disabled={proposalLoading || !props.hasRateCard || deal.stage !== "PROPOSAL"}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-left hover:bg-zinc-50 disabled:opacity-40"
                  >
                    <div className="font-medium text-zinc-900">Generate Proposal Draft</div>
                    <div className="text-xs text-zinc-500">
                      {deal.stage !== "PROPOSAL" ? `Requires PROPOSAL stage (currently ${deal.stage})` : "From rate card + thread context"}
                    </div>
                    {proposalLoading && <div className="text-xs text-zinc-400">Generating…</div>}
                  </button>
                  <button
                    onClick={handleGenerateNudge}
                    disabled={nudgeLoading || !props.hasRateCard || deal.stage === "WON" || deal.stage === "LOST"}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-left hover:bg-zinc-50 disabled:opacity-40"
                  >
                    <div className="font-medium text-zinc-900">Generate Follow-Up Nudge</div>
                    <div className="text-xs text-zinc-500">
                      {deal.stage === "WON" || deal.stage === "LOST" ? "Deal is closed" : "Short, human re-engagement email"}
                    </div>
                    {nudgeLoading && <div className="text-xs text-zinc-400">Generating…</div>}
                  </button>
                </div>
                {!props.hasRateCard && (
                  <p className="mt-4 text-xs text-zinc-500">
                    AI actions require a rate card. <Link href="/settings" className="underline">Add one in Settings</Link>.
                  </p>
                )}
              </section>

              <section className="rounded-lg border border-zinc-200 bg-white p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">Contact</h2>
                  {editingContact ? (
                    <div className="flex gap-2">
                      <button onClick={() => setEditingContact(false)} disabled={busy} className={SECONDARY_BUTTON_CLASS}>
                        Cancel
                      </button>
                      <button onClick={saveContact} disabled={busy} className={PRIMARY_BUTTON_CLASS}>
                        {busy ? "Saving…" : "Save"}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingContact(true)} disabled={busy} className={SECONDARY_BUTTON_CLASS}>
                      Edit
                    </button>
                  )}
                </div>

                {editingContact ? (
                  <div className="space-y-3 text-sm">
                    <label className="block text-zinc-500">
                      Name
                      <input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className={`mt-1 ${INPUT_CLASS}`}
                        maxLength={200}
                      />
                    </label>
                    <label className="block text-zinc-500">
                      Company
                      <input
                        value={contactCompany}
                        onChange={(e) => setContactCompany(e.target.value)}
                        className={`mt-1 ${INPUT_CLASS}`}
                        maxLength={200}
                      />
                    </label>
                    <label className="block text-zinc-500">
                      LinkedIn URL
                      <input
                        value={contactLinkedin}
                        onChange={(e) => setContactLinkedin(e.target.value)}
                        placeholder="https://www.linkedin.com/in/…"
                        className={`mt-1 ${INPUT_CLASS}`}
                      />
                    </label>
                    <p className="text-xs text-zinc-400">
                      Filling these in makes AI briefs and proposals materially better — they are
                      sent to the model as context.
                    </p>
                  </div>
                ) : (
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Name</dt>
                      <dd className="text-zinc-900 font-medium">{deal.contact.name ?? "Unknown"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Email</dt>
                      <dd className="text-zinc-900 font-medium">{deal.contact.email}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Company</dt>
                      <dd className="text-zinc-900 font-medium">{deal.contact.company ?? "Not set"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">LinkedIn</dt>
                      <dd className="text-zinc-900 font-medium">
                        {deal.contact.linkedinUrl ? (
                          <a href={deal.contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700">View</a>
                        ) : (
                          "Not set"
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Source</dt>
                      <dd className="text-zinc-900 font-medium capitalize">{deal.contact.source ?? "unknown"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Last Contact</dt>
                      <dd className="text-zinc-900 font-medium">{fmtDateTime(deal.contact.lastContact)}</dd>
                    </div>
                  </dl>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === "emails" && (
          <div className="space-y-4">
            {deal.contact.emails.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-500">No emails imported yet.</div>
            ) : (
              deal.contact.emails.map((email) => (
                <article key={email.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className={`inline-block rounded-full ${DIRECTION_COLORS[email.direction] ?? DIRECTION_COLOR_FALLBACK} px-2 py-0.5 text-[11px] font-medium`}>
                        {email.direction}
                      </span>
                      <span className="ml-2 text-xs text-zinc-400">{fmtDateTime(email.receivedAt)}</span>
                    </div>
                    {email.gmailId && (
                      <a href={`https://mail.google.com/mail/u/0/#search/rfc822msgid:${email.gmailId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-zinc-600">
                        Open in Gmail
                      </a>
                    )}
                  </div>
                  <h3 className="font-medium text-zinc-900 mb-1">{email.subject || "(no subject)"}</h3>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap max-h-40 overflow-auto font-mono text-[13px]">{email.body || "(no body)"}</p>
                </article>
              ))
            )}
          </div>
        )}

        {activeTab === "facts" && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Every claim the importer extracted, with its source and strength. Untick anything
              that should not count as applied — the ledger is a review surface, not a log.
            </p>
            {deal.contact.facts.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-500">No facts recorded yet.</div>
            ) : (
              deal.contact.facts.map((fact) => (
                <article key={fact.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-zinc-900">{fact.claim}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        <span className={`inline-block rounded-full px-1.5 py-0.5 ${fact.strength === "strong" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {fact.strength}
                        </span>
                        <span className="text-zinc-500">Source: {fact.source}</span>
                        <span className="text-zinc-400">{fmtDateTime(fact.createdAt)}</span>
                      </div>
                    </div>
                    <label className="mt-1 flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-zinc-500">
                      <input
                        type="checkbox"
                        checked={fact.applied}
                        disabled={busy}
                        onChange={(e) => {
                          const next = e.target.checked;
                          void run(() => setFactAppliedAction(fact.id, next));
                        }}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-600"
                      />
                      applied
                    </label>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-4">
            <section className="rounded-lg border border-zinc-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900">Schedule a task</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-zinc-500">
                  Type
                  <select
                    value={taskKind}
                    onChange={(e) => setTaskKind(e.target.value as TaskKind)}
                    className={`mt-1 ${INPUT_CLASS}`}
                  >
                    {TASK_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-zinc-500">
                  Due
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className={`mt-1 ${INPUT_CLASS}`}
                  />
                </label>
                <label className="text-xs text-zinc-500 sm:col-span-3">
                  Why — recorded on the task so future-you can judge if it still matters
                  <input
                    value={taskReason}
                    onChange={(e) => setTaskReason(e.target.value)}
                    placeholder="e.g. waiting on their budget confirmation"
                    maxLength={500}
                    className={`mt-1 ${INPUT_CLASS}`}
                  />
                </label>
              </div>
              <button
                onClick={() => void addTask()}
                disabled={busy || !taskReason.trim()}
                className={`mt-3 ${PRIMARY_BUTTON_CLASS}`}
              >
                {busy ? "Scheduling…" : "Schedule task"}
              </button>
            </section>

            {deal.tasks.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-500">No tasks scheduled.</div>
            ) : (
              deal.tasks.map((task) => (
                <article key={task.id} className={`rounded-lg border border-zinc-200 bg-white p-4 ${task.done ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          task.kind === "brief" ? "bg-violet-50 text-violet-700" :
                          task.kind === "proposal" ? "bg-sky-50 text-sky-700" :
                          "bg-amber-50 text-amber-700"
                        }`}>
                          {task.kind}
                        </span>
                        <span className="text-xs text-zinc-400">Due: {fmtDateTime(task.dueAt)}</span>
                        {task.done && <span className="text-xs text-emerald-600">Done</span>}
                      </div>
                      <p className="text-sm text-zinc-700">{task.reason}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() =>
                          void run(() =>
                            task.done ? reopenTaskAction(task.id) : completeTaskAction(task.id),
                          )
                        }
                        disabled={busy}
                        className={SECONDARY_BUTTON_CLASS}
                      >
                        {task.done ? "Reopen" : "Mark done"}
                      </button>
                      <button
                        onClick={() => void run(() => deleteTaskAction(task.id))}
                        disabled={busy}
                        className={SECONDARY_BUTTON_CLASS}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}