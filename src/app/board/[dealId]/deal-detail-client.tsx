"use client";

import { useState } from "react";
import Link from "next/link";

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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

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
    navigator.clipboard.writeText(text);
    setError("Copied to clipboard");
    setTimeout(() => setError(null), 2000);
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 mb-4">Deal Details</h2>
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
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 mb-4">Contact</h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Name</dt>
                    <dd className="text-zinc-900 font-medium">{deal.contact.name ?? "Unknown"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Email</dt>
                    <dd className="text-zinc-900 font-medium">{deal.contact.email}</dd>
                  </div>
                  {deal.contact.company && (
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Company</dt>
                      <dd className="text-zinc-900 font-medium">{deal.contact.company}</dd>
                    </div>
                  )}
                  {deal.contact.linkedinUrl && (
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">LinkedIn</dt>
                      <dd className="text-zinc-900 font-medium"><a href={deal.contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700">View</a></dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Source</dt>
                    <dd className="text-zinc-900 font-medium capitalize">{deal.contact.source ?? "unknown"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Last Contact</dt>
                    <dd className="text-zinc-900 font-medium">{fmtDateTime(deal.contact.lastContact)}</dd>
                  </div>
                </dl>
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
                      <span className={`inline-block rounded-full bg-${email.direction === "INBOUND" ? "sky" : "violet"}-50 text-${email.direction === "INBOUND" ? "sky" : "violet"}-700 px-2 py-0.5 text-[11px] font-medium`}>
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
                    <input
                      type="checkbox"
                      checked={fact.applied}
                      disabled
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-600"
                    />
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="space-y-4">
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
                    <input
                      type="checkbox"
                      checked={task.done}
                      disabled
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-600"
                    />
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