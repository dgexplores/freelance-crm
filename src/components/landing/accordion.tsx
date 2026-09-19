"use client";

const SLICES = [
  {
    title: "Import",
    body: "Forward-only Gmail sync captures every new thread. Nothing moves, nothing deletes.",
    seed: "slice-import",
  },
  {
    title: "Brief",
    body: "Who they are, what they last said, what to confirm — generated before you dial.",
    seed: "slice-brief",
  },
  {
    title: "Propose",
    body: "Scope and fees pulled verbatim from your rate card. Never invented.",
    seed: "slice-propose",
  },
  {
    title: "Nudge",
    body: "Stale deals surface with a human re-engagement draft attached.",
    seed: "slice-nudge",
  },
];

/** Horizontal accordion: slices expand on hover, reveal image + copy. */
export function HowAccordion() {
  return (
    <div className="flex h-[480px] w-full gap-3 md:h-[560px]">
      {SLICES.map((s) => (
        <div
          key={s.seed}
          className="group relative min-w-0 flex-1 overflow-hidden rounded-3xl border border-white/10 transition-[flex-grow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] hover:flex-[3.2]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-105"
            style={{ backgroundImage: `url(https://picsum.photos/seed/${s.seed}/800/1000)` }}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/35 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <p className="font-display text-xl font-bold text-white md:text-2xl">{s.title}</p>
            <p className="mt-2 max-h-0 overflow-hidden text-sm leading-6 text-zinc-300 opacity-0 transition-all delay-100 duration-500 group-hover:max-h-32 group-hover:opacity-100">
              {s.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
