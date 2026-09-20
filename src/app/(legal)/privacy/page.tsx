import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Inbox CRM",
  description: "How Inbox CRM handles your data.",
};

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-zinc-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: August 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">What we access</h2>
          <p className="mt-2">
            Inbox CRM requests read-only access to your Gmail
            (<code className="rounded bg-zinc-100 px-1">gmail.readonly</code>) when you connect it.
            We import only messages newer than your personal sync boundary (the first import reads
            at most the last 24 hours). We never send, move, archive, or delete your email. You can
            revoke access any time from your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-zinc-900 underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              Google account permissions page
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">What we store</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your Google account identifier, name, email, and avatar.</li>
            <li>Imported message metadata and bodies, used to build your pipeline.</li>
            <li>Contacts, deals, tasks, and extracted facts generated from that mail.</li>
            <li>Your rate card content.</li>
          </ul>
          <p className="mt-2">
            Your data is stored in a PostgreSQL database. Access tokens are stored to maintain the
            Gmail connection; refresh tokens are never shared with third parties other than Google.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">AI processing</h2>
          <p className="mt-2">
            When you generate a brief, proposal draft, or follow-up nudge, relevant deal context
            (contact info, recent emails, your rate card) is sent to our AI provider (Google Gemini)
            solely to produce that output. We do not use your content to train models. AI features
            are opt-in per action.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Your rights</h2>
          <p className="mt-2">
            You may request export or deletion of your account and all associated data at any time
            by contacting us. Deleting your account removes your contacts, deals, emails, facts,
            tasks, and stored tokens.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Contact</h2>
          <p className="mt-2">
            Questions about this policy: open an issue at{" "}
            <a
              href="https://github.com/dgexplores/freelance-crm"
              className="text-zinc-900 underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              github.com/dgexplores/freelance-crm
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
