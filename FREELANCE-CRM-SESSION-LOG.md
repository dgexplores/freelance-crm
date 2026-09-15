# Session Log — freelance-crm

**Date:** 2026-08-25 → 2026-08-26
**Repo:** github.com/dgexplores/freelance-crm (all work on `main`)
**Scope:** Full production-readiness overhaul: security, reliability, ops, UX/AI experience, test coverage, cloud infrastructure.

> No secret values are stored in this file. Local secrets live in `.env` (gitignored); cloud secrets live in the Vercel dashboard.

---

## Starting point

MVP skeleton (~3.4K LOC): Next.js 16 + React 19 + Prisma/Postgres + Better Auth (Google OAuth) + Gemini + Tailwind v4. Good docs, 24 pure-function tests, but: critical IDOR, dead cron feature, broken CI deploy guards, no rate limiting, blocking AI calls, static UI.

---

## Delivered — code commits

| Commit | Contents |
|---|---|
| `07aeef7` | **P0/P1 hardening** — IDOR fixed (session + userId scoping on all AI routes/context loader); cron un-dead via session-less scheduler (`src/lib/scheduler.ts`); typecheck fix; CI deploy guards; `.env.example`; Gemini key → header; retry/backoff layer (`src/lib/retry.ts`); bounded Gmail concurrency; atomic per-message staging; forward-boundary race closed; wonAt/lostReason data fixes; rate-card length cap; DB hot-path indexes |
| `ca94fd2` | **Ops batch** — typed error hierarchy (`src/lib/errors.ts`), instanceof-based HTTP mapping, sanitized 500s; per-user rate limits on AI routes (429 + Retry-After, swap-ready for Redis); Gmail env guards; `vercel.json` cron; Dockerfile (standalone) + `docker-compose.prod.yml`; Privacy + Terms pages; `scripts/restore-db.sh` |
| `c74263d` | **Streaming AI + motion** — zero-dependency SSE passthrough from Gemini (`openGeminiStream`), stream variants for brief/proposal/nudge with identical typed validation; client progressive render: shimmer skeleton → streaming text with blinking caret → fade-up result cards; board card stagger entrance; `prefers-reduced-motion` respected |
| `13b6ab5` | **Drag-and-drop board + integration tests** — @dnd-kit kanban (optimistic moves, snap-back on failure, keyboard sensor, drop-target highlight); separate Vitest config hitting real Postgres (auto-skip when DB down): pipeline staging/dedupe/isolation, loadDealContext owner-scoping (**IDOR regression lock**), scheduler no-dup rules; CI runs them |
| `701dbc4` | `.env.example` un-ignored (was silently swallowed by `.env*` pattern) |
| `13b9f7c` | **Middleware fix found by live boot** — Next 16 rejected old export style; replaced with official `getSessionCookie` lightweight gate |
| `15a9e80` | **Deploy fixes** — `output: standalone` only outside Vercel (NFT tracing conflict); `.vercelignore` keeps secrets/tests out of uploads |

## Delivered — infrastructure (created during session)

| Resource | Detail |
|---|---|
| Supabase Postgres (prod) | Project `freelance-crm-prod`, ref `nnofuumvkyosqlqeypxn`, Singapore; schema pushed via `prisma db push` ✅ |
| Vercel project | `freelance-crm`, linked via CLI; `BETTER_AUTH_SECRET`, `CRON_SECRET`, `DATABASE_URL` set in Production env |
| GitHub CI | Green on every push: lint + typecheck + 24 unit tests + **10 integration tests against real Postgres** + production build (~2m30s) |
| Secrets generated | Auth/cron secrets created locally in `.env`; DB password stored locally only |

## Verification performed

- `typecheck` / `lint` / `test` (24) / `test:int` (10, real DB) / production `build` — all green
- Live local boot: `/api/health` 200, sign-in 200, protected routes redirect unauthenticated (found + fixed middleware bug here)
- Vercel deploy isolation probe (trivial site deploys Ready in seconds → account fine)

---

## Current blocker ⚠️

**RESOLVED.** The original Vercel project's build queue was corrupted (every deployment hung at UNKNOWN with no logs, any deploy method, while a probe project deployed instantly). Fix: deleted + recreated the project via CLI — production deployed **Ready in 1m**.

### LIVE: https://freelance-crm-xi.vercel.app
- `/api/health` → 200 `{database:true}` (Supabase SG connected)
- Auth gate redirecting (`/board` → sign-in), legal pages serving
- `BETTER_AUTH_URL` set to production domain (OAuth callbacks ready)

## What's left

### To go live (user input required, ~10 min)
1. Google Cloud OAuth client → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel env (redirect URI: `https://freelance-crm-xi.vercel.app/api/auth/callback/google`)
2. Gemini API key → `GEMINI_API_KEY` in Vercel env → redeploy (CLI or dashboard)
3. Optional: create a Vercel **dashboard token** (vercel.com/account/tokens) → set as GitHub `VERCEL_TOKEN` secret to re-arm CI auto-deploys (CLI session tokens are app-scoped and rejected for CI)

### Backlog (code, prioritized)
1. Persist AI outputs to DB (regeneration costs tokens today)
2. Onboarding checklist for first-run users
3. Stripe billing + usage metering *(explicitly deferred by owner)*
4. Redis-backed rate limiting (current = per-instance)
5. Playwright E2E layer (integration layer done)
6. HTML-only email body extraction
7. Legal pages: swap placeholder contact info for real entity details
8. Before public launch: `gmail.readonly` restricted-scope strategy (CASA Tier 2 assessment vs waitlist-first launch)

---
Update 2026-08-26: Vercel CI deploy pipeline armed (token + org/project secrets set). Frozen CLI deployments purged; production deploy now flows through GitHub Actions.

---

# Session Log — 2026-09-14/15 (second review + remediation)

**Branch:** `fix/review-p0-hardening`
**Scope:** Independent review of `main` @ `47bc617`, then fixes for everything it found.
**Review document:** [CODE-REVIEW-2026-09.md](./CODE-REVIEW-2026-09.md) (549 lines, 29 findings).

## What the review found

The August audit's own claims were mostly accurate, but it missed five P0 defects. Two of
them broke the product's core purpose:

1. **HTML-only email bodies were discarded.** `extractBody` only decoded `text/plain` parts,
   so a modern HTML email fell through to a 200-character snippet. Most inbound mail is
   HTML-only, so most deals were built from a truncated preview.
2. **One import run silently dropped everything past 250 messages.** `fetchNewMessages`
   capped at `maxPages 10 × pageSize 25`, but the forward boundary advanced to
   `newestFetched` regardless — so the backlog past the cap became permanently invisible.
3. **Boundary advanced on failed/empty runs**, skipping mail after a transient Gmail error.
4. **The SSE reader dropped its final buffered chunk**, truncating AI output.
5. **`npm run predeploy` could never pass** — `prisma migrate status` exits non-zero when
   `prisma/migrations/` does not exist, which is this project's normal state.

Plus: the backup/restore pair could not round-trip (`.sql.gz` vs `.dump.gz`, and `pg_dump`
URL-parsing broke on Supabase pooler URLs), ~180 lines of exported server actions had zero
callers (Tasks, fact review, deal/contact editing were unreachable), a dynamic Tailwind class
(`bg-${color}-50`) was never generated, errors leaked to clients from server actions, and the
Gmail import had no rate limit.

## What was changed

| Area | Change |
|---|---|
| `src/lib/gmail.ts` | Added `htmlToText()`; `extractBody` prefers `text/plain` but converts HTML; `collectBodies` skips attachments; `fetchNewMessages` returns `{ messages, truncated }` at `maxPages 25` / `pageSize 100` |
| `src/lib/pipeline.ts` | Extracted pure `decideBoundaryAdvance()` — never advances on errors or empty fetches; on truncation advances to the *oldest* message and reports it |
| `src/lib/errors.ts` | Added `safeActionMessage()` — only `AppError` messages reach clients; everything else is logged and replaced with a generic fallback |
| `src/lib/ai/gemini.ts` | Extracted `emitLine()`; added `flush()` so the trailing SSE buffer is emitted |
| `src/app/board/actions.ts` | Rate limit on `importGmailAction` (6/min); new `updateDealAction`, `updateContactAction`, `setFactAppliedAction`, `scheduleStaleFollowUpsAction`; all Prisma calls wrapped + sanitized |
| `src/app/board/[dealId]/task-actions.ts` | Rewritten: validation, `reopenTaskAction`, sanitized errors |
| `board-client.tsx`, `deal-detail-client.tsx` | Reconnected the dead UI: task CRUD, fact apply toggle, deal + contact editing; fixed the dynamic Tailwind class with a lookup map |
| `scripts/*.sh` | Backup/restore round-trip fixed; pre-deploy reordered (adds `db:generate`, schema drift, RLS check; drops `migration status`); RLS re-applied after restore |
| Deleted | `board/[dealId]/actions.ts`, `board/[dealId]/schedule-actions.ts`, `components/error-boundary.tsx` (all zero callers) |
| Tests added | `gmail.test.ts`, `errors.test.ts`, `ai/gemini.test.ts`, plus a `decideBoundaryAdvance` suite |
| Docs | `SETUP.md` rewritten (wrong var names, wrong DB provider); `README.md` corrected throughout; this log |

## Verification

`npm ci` is blocked in this sandbox, so the normal gates could not run. Instead the real
modules were transpiled and executed against stubbed imports — **29/29 behavioural checks
pass**, including the HTML conversion, the truncation/error boundary decisions, and the SSE
flush. Every `.ts`/`.tsx` file parses clean; all three shell scripts pass `bash -n`.

**Still unverified:** `typecheck`, `lint`, `test`, and `build` have not been run against
installed dependencies. Run `npm run predeploy` before merging.
