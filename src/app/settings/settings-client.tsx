"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DELETE_CONFIRMATION_WORD } from "@/lib/account-constants";
import { deleteAccountAction, updateRateCardAction } from "./actions";

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

  const router = useRouter();
  const [confirmWord, setConfirmWord] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canDelete = confirmWord === DELETE_CONFIRMATION_WORD && !deleting;

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteAccountAction(confirmWord);
    if (res.ok) {
      // The session rows were deleted as part of the transaction, so the
      // cookie in hand no longer resolves. Leave the protected area.
      router.replace("/");
      return;
    }
    setDeleting(false);
    setDeleteError(res.message);
  }

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
    <div className="max-w-3xl mx-auto px-6 py-8">
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 mb-3">
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
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
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

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 mb-3">
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

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 mb-3">
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

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 mb-3">
          Your data
        </h2>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-medium text-zinc-900">Export everything</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Downloads a JSON file with your profile, rate card, contacts, deals, emails,
            facts, and tasks. OAuth tokens are excluded — they are credentials, not data.
          </p>
          <a
            href="/api/account/export"
            download
            className="mt-3 inline-block rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Download my data
          </a>
        </div>

        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/50 p-4">
          <h3 className="text-sm font-medium text-rose-800">Delete account</h3>
          <p className="mt-1 text-sm text-rose-700">
            Removes your account and every contact, deal, email, fact, and task in it. This
            cannot be undone and there is no backup of it on our side.
          </p>

          {deleteError && (
            <div className="mt-3 rounded-md bg-white px-3 py-2 text-xs text-rose-700">
              {deleteError}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder={`Type ${DELETE_CONFIRMATION_WORD} to confirm`}
              aria-label={`Type ${DELETE_CONFIRMATION_WORD} to confirm account deletion`}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-rose-300 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <button
              onClick={() => void handleDelete()}
              disabled={!canDelete}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? "Deleting…" : "Permanently delete"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}