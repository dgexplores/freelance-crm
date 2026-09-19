"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/board",
      });
      if (error) {
        setError(
          error.message ??
            "Google sign-in failed. Check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Google sign-in failed unexpectedly.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-paper md:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Use Google to open your inbox-first pipeline.
          </p>
          <button
            onClick={signInWithGoogle}
            disabled={busy}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition-transform duration-300 hover:scale-[1.02] disabled:opacity-40"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
              <GoogleIcon />
            </span>
            {busy ? "Redirecting…" : "Continue with Google"}
          </button>
          <p className="mt-5 text-[11px] leading-5 text-zinc-400">
            The CRM reads your inbox (read-only) and never sends, moves, or
            deletes mail.
          </p>
          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="relative hidden overflow-hidden md:block" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-center grayscale contrast-125"
          style={{ backgroundImage: "url(https://picsum.photos/seed/signin-desk/1200/1400)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-paper via-transparent to-transparent" />
        <figure className="absolute bottom-16 left-16 right-24 rotate-[-2deg] rounded-3xl border border-white/30 bg-white/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur">
          <p className="font-display text-xl font-bold text-ink">“Nothing falls through.”</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Auto-scheduled follow-ups with reasons. Stale deals flag themselves.
          </p>
        </figure>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}