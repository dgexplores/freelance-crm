import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Inbox CRM",
  description: "Terms for using Inbox CRM.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-zinc-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: August 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">The service</h2>
          <p className="mt-2">
            Inbox CRM is a pipeline tool for solo freelancers and consultants. It imports your
            inbound Gmail (read-only) into a deal board and drafts AI-assisted briefs, proposals,
            and follow-ups based on your rate card.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Acceptable use</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>One account per person. Do not resell access or scrape the service.</li>
            <li>Do not attempt to access other users&rsquo; data or abuse rate limits.</li>
            <li>You are responsible for the content of your rate card and how you use AI drafts.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">AI outputs</h2>
          <p className="mt-2">
            AI-generated briefs, proposals, and follow-ups are drafts. They may contain errors.
            Review everything before sending it to anyone. Fees in proposals come only from your
            rate card — verify them before quoting clients.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Availability &amp; liability</h2>
          <p className="mt-2">
            The service is provided &ldquo;as is&rdquo;, without warranties. We aim for high
            availability but do not guarantee uninterrupted operation. To the maximum extent
            permitted by law, we are not liable for lost profits, missed opportunities, or damages
            arising from use of the service or reliance on AI output.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Termination</h2>
          <p className="mt-2">
            You may stop using the service and delete your account at any time. We may suspend
            accounts that violate these terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Changes</h2>
          <p className="mt-2">
            We may update these terms; material changes will be announced in-app before taking
            effect.
          </p>
        </section>
      </div>
    </div>
  );
}
