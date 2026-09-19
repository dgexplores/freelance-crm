"use client";

import { useState } from "react";
import { updateRateCardAction, updateProfileAction, updatePreferencesAction, disconnectGmailAction, deletePipelineDataAction } from "./actions";

const DEFAULT_RATE_CARD = `# Rate Card

## Services

| Service | Rate | Unit |
|---------|------|------|
| Strategy / Discovery | $250 | hour |
| Frontend Development (React, Next.js) | $180 | hour |
| Backend Development (Node, Postgres) | $180 | hour |
| API Design & Integration | $150 | hour |
| Code Review & Architecture | $200 | hour |

## Terms

- **Minimum engagement**: 20 hours
- **Payment**: Net 15, 50% upfront for new clients
- **Availability**: Typically 2-3 weeks out
- **Scope changes**: Billed at hourly rate above
- **Maintenance retainer**: 10 hours/month minimum at 80% rate

## Expenses

- Travel: billed at cost + 15%
- Third-party services: billed at cost + 10%
- Stock assets/licenses: billed at cost`;

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "pipeline", label: "Pipeline" },
  { id: "ratecard", label: "AI & Rate card" },
  { id: "gmail", label: "Gmail" },
  { id: "plan", label: "Plan" },
  { id: "danger", label: "Danger zone" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsClient(props: {
  userEmail: string;
  userName: string;
  rateCard: string;
  gmailSyncStartedAt: string | null;
  staleDays: number;
  autoFollowUp: boolean;
  gmailConnected: boolean;
  billing: { used: number; limit: number; status: string; pro: boolean; enabled: boolean };
}) {
  const [active, setActive] = useState<SectionId>("profile");
  const [rateCard, setRateCard] = useState(props.rateCard || DEFAULT_RATE_CARD);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const [name, setName] = useState(props.userName);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [staleDays, setStaleDays] = useState(props.staleDays);
  const [autoFollowUp, setAutoFollowUp] = useState(props.autoFollowUp);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);
  const [gmailMsg, setGmailMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  async function run<T extends { ok: boolean; message: string }>(
    fn: () => Promise<T>,
    setMsg: (m: string | null) => void,
    setBusy?: (b: boolean) => void,
  ) {
    setBusy?.(true);
    setMsg(null);
    try {
      const res = await fn();
      setMsg(res.message);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy?.(false);
    }
  }

  async function handleBilling(path: "/api/billing/checkout" | "/api/billing/portal") {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setBillingError(data.error ?? "Billing request failed.");
      }
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : "Billing request failed.");
    } finally {
      setBillingBusy(false);
    }
  }

  const usagePct = Math.min(100, Math.round((props.billing.used / Math.max(1, props.billing.limit)) * 100));

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-24">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Profile, pipeline rules, AI, connections, billing.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-[220px_1fr]">
          <nav className="flex gap-2 overflow-x-auto md:sticky md:top-24 md:flex-col md:self-start" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-left text-sm font-medium transition-all md:rounded-xl ${
                  active === s.id
                    ? "bg-ink text-white shadow"
                    : "text-zinc-600 hover:bg-zinc-950/5 hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {active === "profile" && (
              <section className="card-enter rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
                <h2 className="font-display text-lg font-bold text-ink">Profile</h2>
                <p className="mb-5 mt-1 text-sm text-zinc-500">Shown on briefs and across the board.</p>
                <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Display name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-ink focus:border-ink focus:outline-none"
                  />
                </label>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Email
                  <input value={props.userEmail} disabled className="mt-2 block w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-500" />
                </label>
                {profileMsg && <p className="mt-3 text-xs text-zinc-600">{profileMsg}</p>}
                <button
                  onClick={() => run(() => updateProfileAction(name), setProfileMsg)}
                  className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition-transform duration-300 hover:scale-105"
                >
                  Save profile
                </button>
              </section>
            )}

            {active === "pipeline" && (
              <section className="card-enter rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
                <h2 className="font-display text-lg font-bold text-ink">Pipeline rules</h2>
                <p className="mb-5 mt-1 text-sm text-zinc-500">Drives stale badges, the board, and the daily cron.</p>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">Stale after</p>
                    <p className="text-xs text-zinc-500">Idle days before a deal needs follow-up.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStaleDays((d) => Math.max(1, d - 1))}
                      aria-label="Decrease threshold"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-ink hover:bg-zinc-100"
                    >
                      −
                    </button>
                    <span className="w-14 text-center font-mono text-sm font-semibold text-ink">{staleDays}d</span>
                    <button
                      onClick={() => setStaleDays((d) => Math.min(30, d + 1))}
                      aria-label="Increase threshold"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-ink hover:bg-zinc-100"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-4 border-t border-zinc-100 pt-5">
                  <div>
                    <p className="text-sm font-medium text-ink">Auto follow-ups</p>
                    <p className="text-xs text-zinc-500">Daily cron schedules nudges for stale deals.</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={autoFollowUp}
                    onClick={() => setAutoFollowUp((v) => !v)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${autoFollowUp ? "bg-lime" : "bg-zinc-300"}`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${autoFollowUp ? "left-6" : "left-1"}`}
                    />
                  </button>
                </div>
                {prefsMsg && <p className="mt-3 text-xs text-zinc-600">{prefsMsg}</p>}
                <button
                  onClick={() => run(() => updatePreferencesAction(staleDays, autoFollowUp), setPrefsMsg)}
                  className="mt-5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition-transform duration-300 hover:scale-105"
                >
                  Save rules
                </button>
              </section>
            )}

            {active === "ratecard" && (
              <section className="card-enter rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
                <h2 className="font-display text-lg font-bold text-ink">AI & Rate card</h2>
                <p className="mb-4 mt-1 text-sm text-zinc-500">
                  Powers briefs and proposals. Markdown — the AI reads tables and terms verbatim. Never invents prices.
                </p>
                {saved && <div className="mb-4 rounded-xl bg-lime/40 px-3 py-2 text-xs font-medium text-ink">Rate card saved</div>}
                {error && <div className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
                <textarea
                  value={rateCard}
                  onChange={(e) => { setRateCard(e.target.value); setSaved(false); setError(null); }}
                  className="min-h-[320px] w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-mono text-sm text-ink placeholder-zinc-400 focus:border-ink focus:outline-none"
                  placeholder={DEFAULT_RATE_CARD}
                  spellCheck={false}
                />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => run(() => updateRateCardAction(rateCard), (m) => { if (!m) return; if (m.includes("saved")) { setSaved(true); setError(null); } else setError(m); }, setSaving)}
                    disabled={saving}
                    className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition-transform duration-300 hover:scale-105 disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Save rate card"}
                  </button>
                  {!props.rateCard && (
                    <button
                      onClick={() => setRateCard(DEFAULT_RATE_CARD)}
                      className="rounded-full border border-zinc-300 px-5 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                    >
                      Use default template
                    </button>
                  )}
                </div>
              </section>
            )}

            {active === "gmail" && (
              <section className="card-enter rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-ink">Gmail</h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${props.gmailConnected ? "bg-lime text-ink" : "bg-zinc-100 text-zinc-600"}`}>
                    {props.gmailConnected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <dl className="grid gap-3 rounded-xl bg-zinc-50 p-4 sm:grid-cols-2">
                  <dt className="text-sm text-zinc-500">Sync boundary</dt>
                  <dd className="font-mono text-sm text-ink">
                    {props.gmailSyncStartedAt
                      ? new Date(props.gmailSyncStartedAt).toLocaleString()
                      : "Not set — first import reads last 24h only"}
                  </dd>
                  <dt className="text-sm text-zinc-500">Scope</dt>
                  <dd className="text-sm text-zinc-700">Read-only (gmail.readonly). Never sends, moves, archives, or deletes.</dd>
                  <dt className="text-sm text-zinc-500">Mode</dt>
                  <dd className="text-sm text-zinc-700">Forward-only. Older mail never imported.</dd>
                </dl>
                {gmailMsg && <p className="mt-3 text-xs text-zinc-600">{gmailMsg}</p>}
                {props.gmailConnected && (
                  <button
                    onClick={() => run(() => disconnectGmailAction(), setGmailMsg)}
                    className="mt-4 rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Disconnect Gmail
                  </button>
                )}
              </section>
            )}

            {active === "plan" && (
              <section className="card-enter rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-ink">Plan</h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${props.billing.pro ? "bg-lime text-ink" : "bg-zinc-100 text-zinc-600"}`}>
                    {props.billing.pro ? "Pro" : "Free"}
                  </span>
                </div>
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>AI generations this period</span>
                  <span className="font-mono">{props.billing.used} / {props.billing.limit}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className={`h-full rounded-full transition-all ${props.billing.pro ? "bg-lime" : "bg-ink"}`} style={{ width: `${usagePct}%` }} />
                </div>
                {billingError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{billingError}</p>}
                <div className="mt-4">
                  {props.billing.enabled ? (
                    props.billing.pro ? (
                      <button onClick={() => handleBilling("/api/billing/portal")} disabled={billingBusy} className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold text-ink transition hover:bg-zinc-100 disabled:opacity-40">
                        {billingBusy ? "Opening…" : "Manage subscription"}
                      </button>
                    ) : (
                      <button onClick={() => handleBilling("/api/billing/checkout")} disabled={billingBusy} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition-transform duration-300 hover:scale-105 disabled:opacity-40">
                        {billingBusy ? "Redirecting…" : "Upgrade to Pro"}
                      </button>
                    )
                  ) : (
                    <p className="text-xs text-zinc-400">Billing not configured yet — free quota of {props.billing.limit} AI generations applies.</p>
                  )}
                </div>
              </section>
            )}

            {active === "danger" && (
              <section className="card-enter rounded-2xl border border-ember/40 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
                <h2 className="font-display text-lg font-bold text-ink">Danger zone</h2>
                <p className="mb-4 mt-1 text-sm text-zinc-500">
                  Deletes all deals, tasks, emails, facts, and contacts. Keeps your account, rate card, preferences, and billing.
                </p>
                <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Type DELETE to confirm
                  <input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="mt-2 block w-full max-w-xs rounded-xl border border-zinc-300 px-4 py-2.5 font-mono text-sm text-ink focus:border-ember focus:outline-none"
                  />
                </label>
                {deleteMsg && <p className="mt-3 text-xs text-zinc-600">{deleteMsg}</p>}
                <button
                  onClick={() => run(() => deletePipelineDataAction(deleteConfirm), (m) => { setDeleteMsg(m); if (m?.includes("deleted")) setDeleteConfirm(""); })}
                  disabled={deleteConfirm !== "DELETE"}
                  className="mt-4 rounded-full bg-ember px-5 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
                >
                  Delete pipeline data
                </button>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
