"use client";

import { useState } from "react";
import { updateRateCardAction } from "./actions";

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

export function SettingsClient(props: {
  userEmail: string;
  userName: string;
  rateCard: string;
  gmailSyncStartedAt: string | null;
}) {
  const [rateCard, setRateCard] = useState(props.rateCard || DEFAULT_RATE_CARD);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await updateRateCardAction(rateCard);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save rate card");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-6 py-8 pt-24">
      <h1 className="font-display mb-8 text-3xl font-bold tracking-tight text-ink">Settings</h1>
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
        <h2 className="font-display mb-3 text-lg font-bold text-ink">
          Rate Card
        </h2>
        <p className="mb-4 text-sm text-zinc-600">
          Your rate card powers AI briefs and proposal drafts. Use markdown — the AI reads
          the tables and terms verbatim. Never invents prices.
        </p>

        {saved && (
          <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Rate card saved
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <textarea
          value={rateCard}
          onChange={(e) => setRateCard(e.target.value)}
          className="w-full min-h-[400px] rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-mono text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          placeholder={DEFAULT_RATE_CARD}
          spellCheck={false}
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition-transform duration-300 hover:scale-105 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save rate card"}
          </button>
          {!props.rateCard && (
            <button
              onClick={() => setRateCard(DEFAULT_RATE_CARD)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Use default template
            </button>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
        <h2 className="font-display mb-3 text-lg font-bold text-ink">
          Gmail Sync
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <dt className="text-sm text-zinc-500">Sync boundary</dt>
            <dd className="text-sm font-mono text-zinc-900">
              {props.gmailSyncStartedAt
                ? new Date(props.gmailSyncStartedAt).toLocaleString()
                : "Not set — first import reads last 24h only"}
            </dd>
            <dt className="text-sm text-zinc-500">Scope</dt>
            <dd className="text-sm text-zinc-700">
              Read-only (gmail.readonly). Never sends, moves, archives, or deletes.
            </dd>
            <dt className="text-sm text-zinc-500">Mode</dt>
            <dd className="text-sm text-zinc-700">
              Forward-only. Boundary recorded after first successful import. Older mail
              never imported.
            </dd>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.05)]">
        <h2 className="font-display mb-3 text-lg font-bold text-ink">
          Account
        </h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <dt className="text-sm text-zinc-500">Name</dt>
            <dd className="text-sm text-zinc-900">{props.userName || "Not set"}</dd>
            <dt className="text-sm text-zinc-500">Email</dt>
            <dd className="text-sm text-zinc-900">{props.userEmail}</dd>
          </dl>
        </div>
      </section>
      </div>
    </div>
  );
}