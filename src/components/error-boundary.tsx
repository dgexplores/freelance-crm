"use client";

import { useEffect, useState } from "react";

export function ErrorBoundary({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      setHasError(true);
      setError(new Error(event.message));
    }
    function handleRejection(event: PromiseRejectionEvent) {
      setHasError(true);
      setError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
    }
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  if (hasError) {
    return (
      fallback ?? (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
            <h1 className="text-xl font-semibold text-zinc-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-zinc-600">
              {error?.message ?? "An unexpected error occurred. Please refresh the page."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Refresh page
            </button>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}