"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Settings error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Failed to load settings. Please try again.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <button onClick={reset} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Try again
          </button>
          <Link href="/board" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">
            Back to pipeline
          </Link>
        </div>
      </div>
    </div>
  );
}