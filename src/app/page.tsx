import Link from "next/link";
import { PinWrap, RiseIn, ScaleMedia, ScrubWords } from "@/components/landing/motion";
import { HowAccordion } from "@/components/landing/accordion";
import { Testimonials } from "@/components/landing/testimonials";

export const metadata = {
  title: "Inbox CRM — your inbox is your pipeline",
  description:
    "Inbox-first pipeline CRM for freelancers. Read-only Gmail import, evidence-based deals, AI briefs and proposals from your rate card.",
};

const MARQUEE = [
  "Forward-only import",
  "Evidence on every deal",
  "Briefs before calls",
  "Proposals from your rate card",
  "Nudges for stale deals",
  "Zero data entry",
];

function InlineImg({ seed, label }: { seed: string; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="mx-2 inline-block h-[0.9em] w-[2.2em] rounded-full bg-cover bg-center align-middle grayscale contrast-125"
      style={{ backgroundImage: `url(https://picsum.photos/seed/${seed}/240/96)` }}
    />
  );
}

export default function Home() {
  return (
    <main className="w-full max-w-full overflow-x-hidden bg-zinc-950 text-white">
      {/* ATTENTION — cinematic center hero */}
      <section className="grain relative flex min-h-[108svh] flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 pb-24 pt-32 text-center">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 40% at 20% 15%, rgba(52,211,153,0.14) 0%, transparent 70%), radial-gradient(ellipse 50% 38% at 85% 80%, rgba(139,92,246,0.16) 0%, transparent 70%), #09090b",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-60 grayscale contrast-125"
          style={{ backgroundImage: "url(https://picsum.photos/seed/inbox-desk/1920/1080)" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 65% at 50% 42%, rgba(9,9,11,0.25) 0%, rgba(9,9,11,0.78) 62%, #09090b 100%)",
          }}
        />
        <div className="relative flex w-full flex-col items-center">
          <RiseIn>
            <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-zinc-200 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Read-only Gmail · never sends, moves, or deletes
            </p>
          </RiseIn>
          <h1 className="font-display w-full max-w-6xl text-balance text-[clamp(2.75rem,5vw,5rem)] font-bold leading-[1.04] tracking-tight">
            Your inbox already wrote your pipeline. We just lay it out.
          </h1>
          <RiseIn delay={0.15}>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-zinc-300">
              Every inbound email becomes a contact and a deal — staged, evidenced,
              and ready to act on. No data entry. No guessing.
            </p>
          </RiseIn>
          <RiseIn delay={0.25}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/board"
                className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_8px_40px_rgba(255,255,255,0.25)] transition-transform duration-300 hover:scale-105"
              >
                Open the board
              </Link>
              <Link
                href="/sign-in"
                className="rounded-full border border-white/30 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur transition-colors duration-300 hover:bg-white hover:text-zinc-950"
              >
                Connect Gmail
              </Link>
            </div>
          </RiseIn>
        </div>
      </section>

      {/* Marquee */}
      <div className="marquee-mask overflow-hidden border-y border-white/10 bg-zinc-950 py-5">
        <div className="marquee-track flex w-max items-center gap-10 pr-10">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} aria-hidden={i >= MARQUEE.length} className="flex items-center gap-10 whitespace-nowrap">
              <span className="font-display text-lg font-semibold tracking-tight text-zinc-100">{m}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
            </span>
          ))}
        </div>
      </div>

      {/* INTEREST — gapless bento */}
      <section className="mx-auto w-full max-w-7xl px-6 py-32 md:py-48">
        <RiseIn>
          <h2 className="font-display max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            The loop, <InlineImg seed="loop-wire" label="deal flow" /> end to end.
          </h2>
        </RiseIn>
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6 md:[grid-auto-flow:dense]">
          <RiseIn className="md:col-span-4">
            <article className="group h-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-900">
              <div className="overflow-hidden">
                <div
                  className="h-64 bg-cover bg-center grayscale contrast-125 opacity-90 transition-transform duration-700 ease-out group-hover:scale-105 md:h-80"
                  style={{ backgroundImage: "url(https://picsum.photos/seed/kanban-board/1200/640)" }}
                />
              </div>
              <div className="p-8">
                <h3 className="font-display text-2xl font-bold tracking-tight">A board that builds itself</h3>
                <p className="mt-3 max-w-xl leading-7 text-zinc-400">
                  INBOX → QUALIFIED → PROPOSAL → WON / LOST. Drag cards between stages
                  with optimistic moves. Stale deals flag themselves after five quiet days.
                </p>
              </div>
            </article>
          </RiseIn>
          <RiseIn delay={0.1} className="md:col-span-2">
            <article className="group flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-white p-8 text-zinc-950">
              <div
                className="h-40 rounded-2xl bg-cover bg-center grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: "url(https://picsum.photos/seed/evidence-note/600/400)" }}
              />
              <div className="pt-6">
                <h3 className="font-display text-2xl font-bold tracking-tight">Evidence, not guesses</h3>
                <p className="mt-3 leading-7 text-zinc-600">
                  Every deal carries the email that created it. Facts graded strong or suggestion.
                </p>
              </div>
            </article>
          </RiseIn>
          <RiseIn className="md:col-span-2">
            <article className="group flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 p-8">
              <div
                className="h-40 rounded-2xl bg-cover bg-center opacity-90 grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: "url(https://picsum.photos/seed/rate-card/600/400)" }}
              />
              <div className="pt-6">
                <h3 className="font-display text-2xl font-bold tracking-tight">Proposals from your rate card</h3>
                <p className="mt-3 leading-7 text-zinc-400">
                  Scope and fees pulled verbatim from your rates. Prices never invented.
                </p>
              </div>
            </article>
          </RiseIn>
          <RiseIn delay={0.1} className="md:col-span-4">
            <article className="group grid h-full overflow-hidden rounded-3xl bg-emerald-300 text-zinc-950 sm:grid-cols-2">
              <div className="p-8">
                <h3 className="font-display text-2xl font-bold tracking-tight">Briefs, nudges, follow-ups</h3>
                <p className="mt-3 leading-7 text-zinc-800">
                  Pre-call briefs before you dial. Human re-engagement drafts when deals go
                  quiet. Streams in live, copies in one click.
                </p>
                <span className="mt-6 inline-block rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-300 group-hover:scale-105">
                  See it on the board
                </span>
              </div>
              <div
                className="min-h-56 bg-cover bg-center grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: "url(https://picsum.photos/seed/call-brief/800/600)" }}
              />
            </article>
          </RiseIn>
        </div>
      </section>

      {/* DESIRE — scrub reveal */}
      <section className="mx-auto w-full max-w-5xl px-6 py-32 md:py-48">
        <ScrubWords
          className="font-display text-center text-3xl font-semibold leading-snug tracking-tight text-white md:text-5xl"
          text="Confidently wrong facts are worse than blank fields. So every claim stays sourced, every price stays yours, and nothing ever sends without your eyes on it."
        />
      </section>

      {/* INTEREST II — horizontal accordion */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-32 md:pb-48">
        <RiseIn>
          <h2 className="font-display max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            Hover the work. <InlineImg seed="hover-slices" label="workflow slices" /> Feel each step.
          </h2>
        </RiseIn>
        <RiseIn delay={0.1}>
          <div className="mt-14">
            <HowAccordion />
          </div>
        </RiseIn>
      </section>

      {/* DESIRE — pinned title + scrolling gallery */}
      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 pb-32 md:grid-cols-[1fr_1.4fr] md:pb-48">
        <PinWrap distance={520} className="md:self-start">
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
            Built for the <InlineImg seed="solo-desk" label="solo freelancer" /> solo seller.
          </h2>
          <p className="mt-6 max-w-md leading-7 text-zinc-400">
            Not a sales team dashboard. A quiet loop that turns threads into revenue
            while you do the work.
          </p>
          <Link
            href="/board"
            className="mt-8 inline-block rounded-full bg-white px-7 py-3 text-sm font-semibold text-zinc-950 transition-transform duration-300 hover:scale-105"
          >
            Try the live board
          </Link>
        </PinWrap>
        <div className="flex flex-col gap-6">
          {[
            { seed: "gallery-inbox", title: "Import", body: "Forward-only Gmail sync. Nothing touched, everything captured." },
            { seed: "gallery-brief", title: "Brief", body: "Who they are, what they said, what to confirm — before the call." },
            { seed: "gallery-proposal", title: "Propose", body: "Drafts grounded in your rate card, editable before sending." },
          ].map((g) => (
            <ScaleMedia key={g.seed} className="rounded-3xl">
              <figure className="group relative overflow-hidden rounded-3xl border border-white/10">
                <div
                  className="h-72 bg-cover bg-center grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-105 md:h-96"
                  style={{ backgroundImage: `url(https://picsum.photos/seed/${g.seed}/1200/800)` }}
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent p-7 pt-16">
                  <p className="font-display text-2xl font-bold">{g.title}</p>
                  <p className="mt-1 text-sm text-zinc-300">{g.body}</p>
                </figcaption>
              </figure>
            </ScaleMedia>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-y border-white/10 bg-zinc-900/40 py-32 md:py-40">
        <Testimonials />
      </section>

      {/* Pricing */}
      <section className="mx-auto w-full max-w-7xl px-6 py-32 md:py-48">
        <RiseIn>
          <h2 className="font-display max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            One seat. One price. <InlineImg seed="solo-price" label="single plan" /> No tiers to decode.
          </h2>
        </RiseIn>
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          <RiseIn>
            <article className="flex h-full flex-col rounded-3xl border border-white/10 bg-zinc-900 p-8">
              <p className="font-display text-xl font-bold">Free</p>
              <p className="mt-1 text-sm text-zinc-400">Taste the loop.</p>
              <p className="font-display mt-6 text-5xl font-bold">$0</p>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-zinc-300">
                <li>Unlimited deals, contacts, tasks</li>
                <li>20 AI generations / month</li>
                <li>Gmail read-only import</li>
              </ul>
              <Link
                href="/board"
                className="mt-8 rounded-full border border-white/25 px-7 py-3 text-center text-sm font-semibold text-white transition-colors duration-300 hover:bg-white hover:text-zinc-950"
              >
                Start free
              </Link>
            </article>
          </RiseIn>
          <RiseIn delay={0.1}>
            <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-lime p-8 text-ink">
              <span className="absolute right-6 top-6 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-lime">
                Solo Pro
              </span>
              <p className="font-display text-xl font-bold">Pro</p>
              <p className="mt-1 text-sm text-ink/60">For sellers who live in their inbox.</p>
              <p className="font-display mt-6 text-5xl font-bold">$19<span className="text-xl">/mo</span></p>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-ink/80">
                <li>Everything in Free</li>
                <li>500 AI generations / month</li>
                <li>Priority import + new features first</li>
              </ul>
              <Link
                href="/settings"
                className="mt-8 rounded-full bg-ink px-7 py-3 text-center text-sm font-semibold text-white transition-transform duration-300 group-hover:scale-[1.02]"
              >
                Upgrade in Settings
              </Link>
            </article>
          </RiseIn>
        </div>
      </section>

      {/* ACTION — asymmetric CTA + footer */}
      <section className="grain relative overflow-hidden px-6 pb-16 pt-32 md:pt-48">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-30 grayscale contrast-125"
          style={{ backgroundImage: "url(https://picsum.photos/seed/closing-deal/1920/800)" }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/70 to-zinc-950" />
        <div className="relative mx-auto grid w-full max-w-7xl items-end gap-10 md:grid-cols-[1.5fr_1fr]">
          <div className="text-left">
            <RiseIn>
              <h2 className="font-display w-full max-w-5xl text-[clamp(2.5rem,5vw,4.75rem)] font-bold leading-[1.02] tracking-tight">
                Stop copying emails into spreadsheets.
              </h2>
            </RiseIn>
            <RiseIn delay={0.15}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/board"
                  className="rounded-full bg-lime px-10 py-4 text-sm font-semibold text-ink shadow-[0_8px_40px_rgba(217,245,76,0.3)] transition-transform duration-300 hover:scale-105"
                >
                  Open the board
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-full border border-white/30 px-10 py-4 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white hover:text-zinc-950"
                >
                  Connect Gmail
                </Link>
              </div>
            </RiseIn>
          </div>
          <RiseIn delay={0.2} className="hidden justify-self-end md:block">
            <figure className="w-72 rotate-3 overflow-hidden rounded-3xl border border-white/20 shadow-[0_24px_80px_rgba(0,0,0,0.5)] transition-transform duration-700 hover:rotate-0">
              <div
                className="h-80 bg-cover bg-center grayscale contrast-125"
                style={{ backgroundImage: "url(https://picsum.photos/seed/won-card/600/800)" }}
              />
              <figcaption className="bg-lime px-5 py-4 text-left">
                <p className="font-display text-lg font-bold text-ink">Deal won</p>
                <p className="text-sm text-ink/70">Proposal accepted · Monday start</p>
              </figcaption>
            </figure>
          </RiseIn>
        </div>
        <div className="relative">
          <footer className="mx-auto mt-28 flex w-full max-w-7xl flex-col items-center justify-between gap-6 border-t border-white/10 pt-8 text-sm text-zinc-500 sm:flex-row">
            <span className="font-display font-bold text-white">Inbox CRM</span>
            <div className="flex items-center gap-6">
              <Link href="/board" className="transition-colors hover:text-white">Pipeline</Link>
              <Link href="/settings" className="transition-colors hover:text-white">Settings</Link>
              <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
              <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
            </div>
            <span>MIT · Solo sellers first</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
