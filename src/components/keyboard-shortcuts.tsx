"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { spring } from "@/components/landing/motion";

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "?") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const shortcuts = [
    { key: "⌘ K", desc: "Open command palette (soon)" },
    { key: "G P", desc: "Go to Pipeline" },
    { key: "G S", desc: "Go to Settings" },
    { key: "N", desc: "New deal (soon)" },
    { key: "/", desc: "Focus search (soon)" },
    { key: "?", desc: "Show this help" },
    { key: "Esc", desc: "Close dialogs / go back" },
    { key: "Tab", desc: "Navigate between elements" },
    { key: "Enter/Space", desc: "Activate buttons/links" },
  ];

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={spring.default}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="shortcuts-title" className="font-display text-lg font-bold text-zinc-900">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 font-mono">⌘⇧?</kbd> anytime to open this</p>
        <dl className="space-y-3 max-h-80 overflow-auto">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
              <dt className="text-sm text-zinc-600">{s.desc}</dt>
              <dd className="flex items-center gap-1.5 text-sm font-mono text-zinc-900">
                {s.key.split(" ").map((k) => (
                  <kbd key={k} className="px-2 py-1 rounded bg-zinc-100 border border-zinc-200 text-xs">
                    {k}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <button
          onClick={() => setOpen(false)}
          className="mt-6 w-full rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
        >
          Got it
        </button>
      </motion.div>
    </motion.div>
  );
}