"use client";

import { useState } from "react";

const QUOTES = [
  {
    quote: "Proposals used to eat my Sundays. Now the thread becomes a draft before my coffee cools.",
    name: "Maya R.",
    role: "Brand designer, solo",
    seed: "maya-portrait",
  },
  {
    quote: "Every number in a proposal traces back to an email. Clients stopped haggling.",
    name: "Jonas K.",
    role: "Full-stack developer",
    seed: "jonas-portrait",
  },
  {
    quote: "The nudge caught two deals I had already written off. That paid for a decade of this.",
    name: "Priya S.",
    role: "Strategy consultant",
    seed: "priya-portrait",
  },
];

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const active = QUOTES[index % QUOTES.length]!;

  return (
    <div className="relative mx-auto w-full max-w-4xl px-6 text-center">
      <div className="flex items-center justify-center gap-3">
        {QUOTES.map((q, i) => (
          <span
            key={q.seed}
            className={`h-12 w-12 overflow-hidden rounded-full border-2 transition-all duration-500 ${
              i === index % QUOTES.length
                ? "scale-110 border-zinc-950"
                : "border-transparent opacity-40"
            }`}
          >
            <span
              aria-hidden="true"
              className="block h-full w-full bg-cover bg-center grayscale contrast-125"
              style={{ backgroundImage: `url(https://picsum.photos/seed/${q.seed}/96/96)` }}
            />
          </span>
        ))}
      </div>
      <blockquote
        key={active.seed}
        className="animate-fade-up mx-auto mt-8 max-w-3xl font-display text-2xl font-medium leading-snug tracking-tight text-zinc-950 md:text-4xl"
      >
        “{active.quote}”
      </blockquote>
      <p className="mt-6 text-sm font-semibold text-zinc-950">{active.name}</p>
      <p className="text-sm text-zinc-500">{active.role}</p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          onClick={() => setIndex((i) => (i + QUOTES.length - 1) % QUOTES.length)}
          aria-label="Previous testimonial"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition hover:bg-zinc-950 hover:text-white"
        >
          ←
        </button>
        <button
          onClick={() => setIndex((i) => (i + 1) % QUOTES.length)}
          aria-label="Next testimonial"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition hover:bg-zinc-950 hover:text-white"
        >
          →
        </button>
      </div>
    </div>
  );
}
