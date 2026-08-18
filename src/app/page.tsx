import Link from "next/link";

export const metadata = {
  title: "Inbox CRM",
  description:
    "Inbox-first pipeline CRM for freelancers. Google sign-in, read-only Gmail import, evidence-based deals.",
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold text-zinc-900">
            Inbox CRM
          </span>
          <Link
            href="/sign-in"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Your inbox is your pipeline.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-600">
          Every inbound email becomes a contact and a deal — staged in a board,
          with the evidence that put it there. No data entry. No guessing.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Get started
          </Link>
        </div>
        <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
          {[
            {
              title: "Forward-only import",
              body: "Read-only Gmail scope. Imports only mail newer than your sync boundary — never moves, archives, or deletes.",
            },
            {
              title: "Evidence, not guesses",
              body: "Every deal carries the email that put it in the pipeline. Facts are sourced and graded strong or suggestion.",
            },
            {
              title: "A board you can act on",
              body: "INBOX → QUALIFIED → PROPOSAL → WON/LOST. Move deals with one click.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <h2 className="font-semibold text-zinc-900">{f.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}