"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-zinc-50 px-6">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-zinc-900">Application Error</h1>
          <p className="mt-2 text-sm text-zinc-600">
            An unexpected error occurred. Please refresh the page or try again later.
          </p>
          <button onClick={reset} className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Refresh page
          </button>
        </div>
      </body>
    </html>
  );
}