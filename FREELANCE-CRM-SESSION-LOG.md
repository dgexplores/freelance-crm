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

---

# Session Log — 2026-09-15 (capability pass)

**Branch:** `fix/review-p0-hardening` (continued)
**Scope:** Beyond the bug fixes — make the system more capable for the person actually using it.

## Why these four

The review found the app was correct but shallow in four places that matter daily:

1. **You could not find a deal.** Five columns of cards, no search, no filter, no sort. Fine at
   ten deals, useless at fifty.
2. **You could not see the whole conversation.** The Emails tab stopped at the newest 20 with no
   "load more", so older context — often where the actual scope or budget was agreed — was
   unreachable from inside the app.
3. **You could not take your data out.** The privacy policy promised export and deletion, but
   only "by contacting us". A promise you cannot keep yourself is not a feature.
4. **The board showed no numbers.** No pipeline value, no won total. For a freelancer that is
   the first question.

## What was built

| Area | Change |
|---|---|
| `src/lib/staleness.ts` (new) | The "is this deal going quiet?" rule, extracted from `ai/context.ts` which imports Prisma and therefore could not be used by a client component. Prisma-free, takes plain dates. `context.ts` now delegates to it, so the server's `staleCount` badge and the board's "needs follow-up" filter cannot drift apart. Dropped the unused `PROPOSAL_STAGES`. |
| `src/lib/board-filter.ts` (new) | `matchesQuery` (all whitespace-separated tokens must match, across title / contact / email / evidence / subject / sender / stage), `filterDeals`, `sortDeals`, `dealIsStale`, `dealIdleDays`. Pure, so testable without rendering React. |
| `board-client.tsx` | Search box, stage chips with `shown/total` counts, "needs follow-up" toggle, sort selector, clear-filters, an empty state that explains itself, and a totals strip (open value, won value, lost, unpriced-open count). `nowMs` comes from the server so SSR and hydration agree on staleness. |
| `email-actions.ts` (new) + deal page | `loadMoreEmailsAction(dealId, beforeIso)` pages backwards 20 at a time, fetching one extra row to detect whether another page exists. Scoped by `userId` **and** the deal's contact. |
| `src/lib/account.ts` (new) | `collectUserData` (export payload) and `deleteUserData` (erasure). |
| `src/app/api/account/export/route.ts` (new) | `GET` → JSON download, `Content-Disposition: attachment`, `Cache-Control: no-store`. Not covered by the middleware matcher, so the session check inside is the access control. |
| `settings/actions.ts` + `settings-client.tsx` | `deleteAccountAction` (requires typing `DELETE`) and a "Your data" section with the export link and the delete flow. |
| Privacy policy | Rewritten from "contact us" to point at the self-serve controls, plus a link to revoke Google access. |

## Two decisions worth recording

**OAuth tokens are excluded from the export.** `Account` holds live `accessToken` / `refreshToken`
values. Including them would turn a data-portability feature into a credential-leak feature, so
they are left out and the omission is stated in the payload itself.

**Deletion is ordered, not cascaded.** `Contact`, `Deal`, `Email` and `Fact` all hold a required
`user` relation with no `onDelete: Cascade`, so deleting the `User` first fails on a foreign key.
The erasure goes deepest-first inside one transaction — Task → Fact/Email/Deal → Contact →
Session/Account → User — so a mid-way failure rolls back instead of leaving a half-deleted account.

## Bugs found while doing this

- **`"use server"` modules exporting values.** `actions.ts` exported `DEAL_STAGES` and
  `task-actions.ts` exported `TASK_KINDS`. Next.js only permits async-function exports from a
  `"use server"` file, so both would have failed `next build`. `DEAL_STAGES` was only used inside
  its own module (un-exported); `TASK_KINDS` moved to `src/lib/tasks.ts` because the deal page is
  a client component and needs it as a runtime value.
- **A near-miss Prisma-in-the-browser import.** The settings client briefly imported
  `DELETE_CONFIRMATION_WORD` from `@/lib/account`, which imports Prisma — and `@/lib/prisma` has
  no `server-only` guard, so it would have silently bundled the Prisma client into the browser.
  Moved to `src/lib/account-constants.ts`.
- **Hydration hazard avoided.** Staleness depends on the current time. Computing `Date.now()` on
  the server *and* in the browser would let a deal cross the 5-day line between the two renders,
  producing a hydration mismatch, so the server passes `nowMs` down.

## Verification

Harness extended from 29 to **80 behavioural checks, all passing** — the shared staleness rule
(including that exactly 5 idle days is *not* stale, matching the original exclusive cutoff), the
search/filter/sort semantics, the export payload shape and token exclusion, and the deletion
ordering (asserted by recording call order inside a stubbed transaction).

Unit tests added: `staleness.test.ts`, `board-filter.test.ts`, `account.test.ts`.

**Still unverified:** `typecheck`, `lint`, `test`, `build`. `npm ci` remains blocked in this
sandbox. The new vitest files are written but have never been executed — the behaviour they
assert *is* verified, but through the harness rather than through vitest. Run
`npm run predeploy` before merging.

---

# Session Log — 2026-09-17/19 (test execution + light-only theme)

## Why this pass

The previous pass ended with a caveat: *"The new vitest files are written but have never been
executed — the behaviour they assert is verified, but through the harness rather than through
vitest."* A test that has never run is documentation, not verification. This pass closed that
gap, and then fixed the two defects it exposed.

## What was done

### 1. The test suite was executed for the first time — 83 passed, 0 failed

`npm test` had never run in this engagement (`npm ci` is blocked in the sandbox, so `vitest`
cannot be installed). A dependency-free shim standing in for the `vitest` API was built —
`describe` / `it` / `expect` with the matchers these files use, `vi.fn`, the four hooks, and the
asymmetric matchers (`expect.objectContaining` and friends). Each of the seven files is bundled
and run separately so module and mock state is isolated per file, the way vitest isolates by
default. The factories from `vitest.setup.ts` are provided as real modules through bundler
aliases, so the files themselves are unmodified.

Result: **83 passed, 0 failed** across `account`, `board-filter`, `errors`, `gmail`, `logger`,
`pipeline`, and `staleness`.

### 2. A real defect this exposed: `board-filter.test.ts` could not link

```
✘ [ERROR] No matching export in "src/lib/board-filter.ts" for import "DAY_MS"
    src/lib/board-filter.test.ts:3:2
```

The test imported `DAY_MS` from `@/lib/board-filter`, which never exported it — the constant
lives in `@/lib/staleness`. This is not a shim artefact: a real `vitest` run fails at link time
the same way, so `npm test` was red as committed. Fixed by importing `DAY_MS` from the module
that defines it; the assertions are untouched. Widening `board-filter`'s public surface to
re-export a constant the test only uses to build fixtures would have been the wrong fix.

### 3. The ordering assertions were proved load-bearing

`account.test.ts` asserts that children are deleted before their parents (Task → Deal,
Deal/Fact/Email → Contact) by comparing `mock.invocationCallOrder` across different mocks. A test
that passes for the wrong reason is worse than no test, so it was mutation-tested: swapping
`deal.deleteMany` above `task.deleteMany` in `deleteUserData` produced **exactly one** failure —
the ordering test — and nothing else. The assertion catches the foreign-key violation it claims
to.

### 4. Settings rendered near-black on near-black on a dark-mode system

`settings-client.tsx` set no background of its own, so it inherited `body`'s theme-aware
`--background`. On a system with a dark preference that is `#0a0a0a`, while the page's text is
`text-zinc-700` — effectively unreadable. Every sibling page (`board`, the deal page, sign-in,
home, all four error boundaries, the skeletons) hardcodes `min-h-screen bg-zinc-50`; Settings was
the only one that did not. Added the same wrapper.

### 5. The vestigial dark override in `globals.css` — the root cause

The Settings bug was a symptom. `globals.css` carried the `create-next-app` default:

```css
@media (prefers-color-scheme: dark) {
  :root { --background: #0a0a0a; --foreground: #ededed; }
}
```

There is **not a single `dark:` variant anywhere in `src/`** and every page hardcodes a light
surface, so the app has no dark theme — the block only flipped the two variables, which is
precisely what fought every page's own colours. Any element that did not paint its own background
showed near-black; any text that inherited `color` went near-white. Removed, with a comment
recording why it is deliberately absent. Adding a dark theme means styling every surface, not
just these two variables.

## Verification

**202 behavioural checks, all passing** (101 server-render + 55 filter/sort/paging logic + 46
driven in a real browser over the DevTools Protocol), plus **83 unit tests**.

The render and interaction checks import the *real* client components and the real Prisma-free
libs; only the boundary is substituted (`next/navigation`, `next/link`, `@dnd-kit/core`, and the
`"use server"` modules, which need Postgres). The browser driver actually clicks and types rather
than asserting on markup.

Two harness problems were found and fixed while doing this, both worth recording:

- **The harness lived in `/tmp` and `/tmp` was wiped mid-session**, destroying the bundle. It now
  builds into the workspace, and the disposable Chrome profiles moved to `os.tmpdir()` where
  scratch belongs. A verification harness that disappears is not a harness.
- **A check that could not fail.** The first version of the dark-mode regression check asserted
  on *computed style*. But this harness forces `<meta name="color-scheme" content="light">` and
  the Tailwind browser build injects its own later `:root`, so the cascade here does not reproduce
  the real build's — the check passed with the dark block reinstated. It now asserts on the
  stylesheet itself via the CSSOM, and is mutation-tested: re-adding the block fails it, removing
  it passes. The first attempt at *that* version matched the phrase inside the explanatory comment
  and so failed on correct code; matching a real `CSSMediaRule` rather than a substring fixed it.

## What's left

**Still open:**

- `npm run predeploy` has still never run — `typecheck`, `lint`, `test`, `build`, the DB drift
  check and the RLS check. `npm ci` remains blocked in this sandbox.
- The unit tests ran through a shim, not vitest. Pass/fail is real; vitest's own configuration,
  coverage reporting and watch mode are not exercised. Run `npm test` once dependencies install
  to confirm.
- **CI cannot run either, so the gap above is not covered by the pipeline.** Both jobs
  (`Lint & Typecheck`, `Tests`) fail in ~4 seconds with `runner_name` empty and zero steps
  executed. GitHub's annotation names the cause: *"The job was not started because recent account
  payments have failed or your spending limit needs to be increased."* A green run on `main`
  takes ~2m24s by comparison, so the pipeline is not executing any code. **Fix the billing /
  spending limit in GitHub settings, then re-run the workflow — nothing in the branch needs to
  change for CI to start.** Until then, a red check on this repo says nothing about the code;
  check `runner_name` before reading a failure as a verdict.

**Resolved since the previous pass:**

- ~~The PR is not open.~~ **PR #2 is open** against `main`:
  https://github.com/dgexplores/freelance-crm/pull/2 (`gh` was available after all — it is
  installed at `/opt/homebrew/bin/gh`; the shell's `PATH` simply omits Homebrew, so it must be
  called by absolute path).

**Optional, not done:**

- `import "server-only"` in `src/lib/prisma.ts`. It currently has no guard, so importing any
  Prisma-touching module from a client component silently bundles Prisma into the browser instead
  of failing loudly. This has already been a near-miss once.
- Persisting AI outputs. Briefs, proposals and nudges are generated and discarded.
