# `dgexplores/freelance-crm` — Full Code & Product Review

**Reviewed:** 2026-09-14
**Repo:** `git@github.com:dgexplores/freelance-crm.git` (SSH, cloned to `./freelance-crm`)
**Revision:** `47bc617` — *Merge pull request #1 from dgexplores/fix/supabase-rls-lockdown* (`main`)
**Branches:** `main`, `origin/fix/supabase-rls-lockdown` (already merged via PR #1)
**Size:** ~4,500 LOC across 58 files in `src/` (39 `.ts`, 22 `.tsx`, 1 `.css`)

---

## 1. Executive summary

**What it is.** A single-tenant-by-design pipeline CRM for solo freelancers. It reads Gmail (read-only, forward-only), auto-stages inbound threads into a deal board with *evidence* attached to every card, and generates pre-call briefs, proposal drafts, and follow-up nudges from the freelancer's own rate card. Positioning is honest and narrow: "CRM as a side effect of email, not a chore before it."

**Verdict.** This is **well above average for an AI-assisted solo build.** The security and reliability work is genuinely thoughtful — IDOR was closed with owner-scoping plus a regression test, errors are a typed hierarchy mapped by `instanceof`, the Gmail boundary advances to the *newest fetched message* rather than `now` (a detail most people get wrong), and per-message DB staging is transactional. The docs are unusually candid (the session log lists what's left, including the blocker that was resolved).

**But it is not finished, and the gaps cluster in three places:**

1. **The Gmail import can permanently lose mail** on any backlog larger than 250 messages, and it silently discards HTML-only email bodies — which is most modern mail. The two things the product is *for* are the two things that are broken.
2. **A large fraction of the advertised feature set has no UI path.** Tasks, fact review, and manual deal/contact editing are all read-only or entirely unreachable. `README.md` claims capabilities that the code cannot perform. Roughly 180 lines of exported server actions have zero callers.
3. **Ops scripts are mutually inconsistent** — the backup/restore pair cannot round-trip, and the pre-deploy script can never pass.

**Scorecard**

| Area | Grade | Note |
|---|---|---|
| Security (app layer) | **A−** | IDOR closed, typed errors, key in header, rate limits. Weak spots: no CSP/HSTS, unsanitized errors in actions, cookie-presence-only middleware |
| Security (data layer) | **C** | RLS lockdown is a manual one-shot script with no migration tracking; regresses on every new table |
| Reliability | **B** | Retry/backoff, transactions, dedupe are good. Boundary-advance bug causes silent data loss |
| Product completeness | **D+** | ~40% of documented features are unreachable from the UI |
| Data model | **C+** | Evidence model is a genuine strength; one-deal-per-contact-forever and never-populated `company`/`linkedinUrl` are real flaws |
| Performance | **C** | N+1 on the board's hot path; no pagination anywhere; cron will time out at scale |
| Testing | **C** | Integration tests target the right risks; "24 unit tests" are ~24 assertions on 4 pure functions |
| Docs | **B+** | Thorough and honest in the README/session log; `SETUP.md` is materially wrong |
| Ops / deploy | **C+** | Docker + CI + cron all real; scripts broken, CLI unpinned, no migrations |

**Fix these five things first:** the 250-message boundary jump (§4.1), HTML body extraction (§4.2), the backup/restore mismatch (§4.3), no Prisma migrations (§4.4), and the unreachable Tasks/editing UI (§4.5).

---

## 2. What the tool actually is

### Stack

| Layer | Choice |
|---|---|
| Framework | Next.js **16.3.0** (App Router, RSC, server actions) |
| UI | React **19.2.8**, Tailwind CSS **v4**, `@dnd-kit/core` for kanban |
| Data | Prisma **6.19** + PostgreSQL (prod: Supabase, Singapore) |
| Auth | `better-auth` 1.6 with Google OAuth, `gmail.readonly` scope |
| AI | Google Gemini (`gemini-3.6-flash`), SSE streaming |
| Observability | `@sentry/nextjs` v10, structured JSON logger |
| Deploy | Vercel (primary) + Docker standalone / compose (alternative) |
| Tests | Vitest — 24 unit (jsdom, heavily mocked) + 10 integration (real Postgres) |
| CI | GitHub Actions: lint → typecheck → unit → integration → build → Vercel deploy |

### Route map

```
Pages                          API routes
────────────────────────────   ──────────────────────────────────────────
/                → redirect    /api/auth/[...all]        better-auth (Google OAuth)
/board           (protected)   /api/ai/brief             POST  stream, 10/min
/board/[dealId]  (protected)   /api/ai/proposal          POST  stream, 10/min
/settings        (protected)   /api/ai/nudge             POST  stream, 10/min
/sign-in                       /api/ai/nudge/stale       GET   JSON,   30/min
/privacy  /terms  (public)     /api/cron/stale-followups GET   Bearer CRON_SECRET
                               /api/health               GET   200/503
```

Protection is two-layer: `src/middleware.ts` does a **cookie-presence** check on `/board/*` and `/settings/*` only, and every data path re-verifies server-side via `getUser()` → `auth.api.getSession()`. That split is correct — the middleware is a UX redirect, not a security boundary, and the code comments say so.

### Data model

```
User ──┬── Account / Session / Verification     (better-auth)
       ├── Contact ──┬── Deal ── Task           (Task has no userId; scoped via Deal)
       │             └── Email
       └── Fact                                  (nullable link to Contact)
```

The interesting part is the **evidence model**: `Deal.whyInPipeline` stores the literal email that created the deal, and `Fact` carries `claim` + `source` + `strength` (`strong` vs `suggestion`) + `applied`. The design intent — *"No guessing. Confidently wrong facts are worse than blank fields."* — is carried through into the AI prompts, which explicitly forbid inventing prices.

### The loop

```
Inbound Gmail ──▶ Forward-only import ──▶ Contact / Deal / Fact staging ──▶ Kanban board
   (read-only)      (per-user boundary)         (atomic per message)         (drag + move)
                                                                                  │
        Stale ≥5d ──▶ Cron 09:00 ──▶ Follow-up task ◀── Nudge ◀── Brief / Proposal (AI)
                                                                     from rate card
```

---

## 3. What's genuinely good (credit where due)

These are not filler — each is a decision that is easy to get wrong and was gotten right.

1. **IDOR closed properly, and locked with a test.** `loadDealContext` scopes by `{ id: dealId, userId }` and throws `DealNotFoundError`; `tests/integration/context-scope.test.ts` asserts a non-owner gets a 404. Every AI route and server action re-checks ownership before touching data.
2. **The forward-only boundary advances to the newest *fetched* message, not `now`.** `src/lib/pipeline.ts` computes `newestFetched` and passes that. The comment explains why: mail arriving mid-import gets picked up next run instead of being skipped. Overlap is safe because of `@@unique([userId, gmailId])`. This is the correct pattern.
3. **Typed error hierarchy mapped by `instanceof`.** `src/lib/errors.ts` + `src/lib/ai/http.ts` map `RateLimitError → 429 + Retry-After`, `AiUnavailableError → 503`, `GeminiApiError → 502`, `AppError → its own status`, unknown → generic 500 with the stack logged server-side only. No string matching, no leaking internals.
4. **Retry with backoff + jitter, opt-in per error class.** `src/lib/retry.ts` requires a `retryOn` predicate, and callers distinguish transient (429, 5xx, network) from permanent (4xx auth). Gemini's API key goes in an `x-goog-api-key` header, not the URL — so it can't leak into proxy logs.
5. **Streaming validation happens before any bytes flow.** `openGeminiStream` throws before returning the `ReadableStream`, so route handlers can still emit a clean JSON error. Deliberately single-attempt once streaming starts, to avoid duplicating output.
6. **Atomic per-message staging.** Contact upsert + email row + deal evidence + facts all inside one `prisma.$transaction`, with counters advancing only after commit.
7. **Boundary Gmail read scope.** Only `messages.list` and `messages.get?format=full` are ever called. No send/trash/modify. The `gmail.ts` header comment states the invariant explicitly, and the sign-in page and privacy policy both repeat it to the user.
8. **Zero-dependency SSE handling.** `sseToPlainText()` is a hand-rolled `TransformStream` that strips Gemini's `data:` framing and skips malformed frames rather than corrupting the stream. No SDK, no dependency.
9. **Honest documentation.** `FREELANCE-CRM-SESSION-LOG.md` records what was done, what was verified, what's blocked, and what's left — including that the Vercel project's build queue was corrupted and had to be recreated. That's rare and useful.

---

## 4. Findings — P0 / P1 (fix before anyone else uses this)

### 4.1 🔴 Gmail import permanently loses mail on any backlog > 250 messages

**File:** `src/lib/gmail.ts` (`fetchNewMessages`), `src/lib/pipeline.ts` (`importGmail`)

`fetchNewMessages` hard-caps at `maxPages = 10 × pageSize = 25` → **250 messages**, fetching newest-first. `importGmail` then sets the boundary to `newestFetched` whenever `errors.length === 0`:

```ts
const newestFetched = messages.reduce<Date | null>(
  (max, m) => (!max || m.receivedAt > max ? m.receivedAt : max), null);
await recordForwardOnlyBoundary(userId, newestFetched ?? new Date());
```

If the query matches more than 250 messages, messages ranked 251+ are **never fetched**, and the boundary has already jumped past them. The next run queries `after:<newestFetched>`, so they are unreachable forever.

This directly contradicts the invariant documented three lines above it — *"The boundary never moves, so no message is ever skipped between imports"* — and the same claim in `README.md` ("Forward-only — older mail never imported") and `SETUP.md`.

**Trigger:** realistic. The boundary only advances on import, so a user who doesn't open the app for a month accumulates a backlog well past 250.

**Fix:** detect truncation and only advance the boundary to the oldest message actually fetched in the truncated case, not the newest.

```ts
const truncated = /* true if the loop exited via maxPages with a live nextPageToken */;
const advanceTo = truncated
  ? new Date(Math.min(...messages.map(m => m.receivedAt.getTime())))
  : newestFetched;
```

Then the next run re-queries the un-fetched window; `@@unique([userId, gmailId])` makes the overlap harmless. Also raise `maxPages` and/or surface a "more mail pending" indicator so a long backfill is visible rather than silent.

**Related, same file:** if `messages.length === 0` the boundary is set to `new Date()`, which can skip mail that exists but wasn't returned due to Gmail indexing lag. Prefer leaving the boundary untouched on an empty result.

---

### 4.2 🔴 HTML-only email bodies are silently dropped

**File:** `src/lib/gmail.ts` (`extractBody`)

```ts
function extractBody(payload: GmailPart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) { ... }
  for (const part of payload.parts ?? []) { /* recurse */ }
  return "";
}
```

Only `text/plain` is decoded. Most real-world mail is `multipart/alternative` — and a large share of senders, marketing systems, and mobile clients produce **HTML-only** bodies. For those, `extractBody` returns `""`, and `runPipeline` falls back:

```ts
body: msg.body || msg.snippet || "(no text)",
```

`snippet` is Gmail's ~200-character preview. So for a large fraction of inbound mail:

- the **Emails tab** shows a truncated fragment instead of the message;
- the **AI brief/proposal/nudge prompts** receive a fragment instead of the thread — degrading exactly the output quality the product is sold on;
- `buildFacts` keyword-matches against a fragment, so budget/project/urgency facts are missed.

The team already knows (backlog item 6: *"HTML-only email body extraction"*), but its blast radius is larger than the backlog phrasing suggests — it degrades the AI surface, not just the reading experience.

**Fix:** on `text/html`, strip tags to text (a ~15-line regex or a small dependency like `html-to-text`), and prefer `text/plain` when both parts exist. Also consider `format=full` → the lighter `format=metadata` + `format=full` split if quota becomes a concern.

---

### 4.3 🔴 The backup and restore scripts cannot round-trip

**Files:** `scripts/backup-db.sh`, `scripts/restore-db.sh`

Two independent mismatches, both fatal to the pair:

| | `backup-db.sh` | `restore-db.sh` |
|---|---|---|
| Filename | `freelance-crm_$TIMESTAMP.sql.gz` | globs `*.dump.gz` |
| Default dir | `/var/backups/freelance-crm` | `./backups` |

So `./scripts/restore-db.sh` with no argument **always** fails with `ERROR: no .dump.gz backups found in ./backups`, even immediately after a successful backup. And `.env.example` sets `BACKUP_DIR="./backups"` while `backup-db.sh` defaults to `/var/backups/freelance-crm` — a third inconsistency.

This is the script you reach for at 2am during an incident. It has almost certainly never been tested end-to-end (the session log records verification of typecheck/lint/test/build/health, but not a backup→restore cycle).

**Fix:** pick one convention (`freelance-crm_<ts>.dump.gz` is the better one — the file *is* a `pg_restore` custom-format dump, and `.sql.gz` is actively misleading since `pg_restore` is required to read it), align both scripts and `.env.example`, and add a CI job that runs backup → restore against the throwaway Postgres service container. That last part is what actually prevents regression.

**Also:** `backup-db.sh` checks `$?` after a pipeline ending in `gzip` without `set -o pipefail` in that spot — the `set -euo pipefail` at the top does cover it, so this one is fine. But `pg_dump` writes to a gzip pipe, so a `pg_dump` failure can still surface as a truncated-but-valid gzip; the existing `gunzip -t` verification catches that. Good.

---

### 4.4 🔴 No Prisma migrations — and the pre-deploy script can never pass

**Files:** `prisma/` (only `schema.prisma` + `rls-lockdown.sql`), `scripts/pre-deploy.sh`, `package.json`

There is no `prisma/migrations/` directory. The project uses `prisma db push` exclusively. Consequences:

1. **`scripts/pre-deploy.sh` step 7 runs `npx prisma migrate status`** — this exits non-zero with *"No migration found in prisma/migrations"*. So `npm run predeploy`, documented in `README.md` as the pre-deployment checklist, **cannot succeed on a clean checkout.**
2. **No schema history, no rollback, no drift detection.** Prod (Supabase) was pushed manually via `db push`; nothing records what state it's in. A future `db push` from a divergent local schema can silently drop columns.
3. `scripts/pre-deploy.sh` step 6 runs `npx prisma db execute --stdin <<< "SELECT 1;"` with no `--url`/`--schema` flag — this needs verification; it likely errors on Prisma 6.
4. `pre-deploy.sh` never runs `prisma generate` before `typecheck`, so on a fresh clone `@prisma/client` is the un-generated stub.

**Fix:** adopt `prisma migrate dev` / `migrate deploy`. Baseline the existing prod schema with `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migrations/0000_init/migration.sql` and mark it applied. Then replace step 7 with `prisma migrate deploy` (or `migrate status` only where a migrations dir now exists), and add `prisma generate` before typecheck.

---

### 4.5 🔴 Roughly 40% of the advertised feature set is unreachable from the UI

`README.md` §Core Features promises things the code cannot do. Verified by grep — these exported symbols have **zero callers** anywhere in `src/`:

| Dead code | Location | README claim it fails to back |
|---|---|---|
| `createTaskAction`, `completeTaskAction`, `deleteTaskAction` | `src/app/board/[dealId]/task-actions.ts` | §7 *"Manual: Create follow-up/brief/proposal tasks from deal detail"* |
| `scheduleStaleFollowUpsAction` | `src/app/board/[dealId]/schedule-actions.ts` | implied manual stale-scheduling |
| `generateBriefAction`, `generateProposalAction`, `generateNudgeAction` | `src/app/board/[dealId]/actions.ts` | superseded by the streaming routes |
| `ErrorBoundary` | `src/components/error-boundary.tsx` | — |
| `createLogger` | `src/lib/logger.ts` | referenced only from its own test |
| `PROPOSAL_STAGES` | `src/lib/ai/context.ts` | exported, never used |
| `geminiConfigured()` | `src/lib/ai/gemini.ts` | exported, never used |

Concretely, in the UI:

- **Tasks tab** (`deal-detail-client.tsx:493–526`) renders a `disabled` checkbox. You can never create, complete, or delete a task. Tasks appear only via the daily cron.
- **Facts tab** (`:462–491`) renders a `disabled` checkbox bound to `applied`. There is no accept/reject flow — so the "Evidence Ledger" review surface the README sells doesn't exist.
- **Nothing is editable.** Deal title, `Deal.value`, contact name/company/LinkedIn, `lostReason` — no edit affordance anywhere. `moveDealAction` writes the literal string `"No reason recorded."` as `lostReason` with no way to replace it.
- **`Deal.value` is never set by any code path**, so every deal renders "Not set" and every AI prompt says `Estimated value: unknown`. The pipeline doesn't estimate it and no UI sets it.

**Fix:** either build the missing UI (edit forms, task CRUD wiring, fact accept/reject) or trim the README to match. Shipping docs that overstate capability is worse than shipping less — it destroys the "trustworthy records" positioning the product is built on. If scope is tight, delete the dead actions rather than leaving them as false affordances.

---

### 4.6 🟠 Data-integrity flaws in the pipeline

**a) One deal per contact, forever.** `runPipeline`:

```ts
const existingDeal = await tx.deal.findFirst({ where: { userId, contactId }, orderBy: { createdAt: "asc" } });
if (!existingDeal) { /* create */ } else if (existingDeal.stage === "INBOX") { /* refresh evidence */ }
```

A returning client who emails again produces **no new deal** — the old one (possibly `WON` months ago) just sits there with refreshed evidence suppressed. Repeat business is the norm for freelancers; this is a modelling flaw, not a nitpick. README even advertises it as a feature ("one deal per contact"), which suggests it's intentional — worth a deliberate decision rather than an accident. Consider keying on `(userId, contactId, threadId)` or allowing a new deal when the existing one is terminal.

**b) Deal title is frozen at the first email's subject.** `makeDealTitle` runs only on creation. Long threads accumulate under a stale subject line.

**c) `Contact.company` and `Contact.linkedinUrl` are never written by anything.** The schema has them, the deal page renders them conditionally, the AI prompts consume them (`Company: ${ctx.contact.company ?? "unknown"}`), and `README.md` §5 advertises `signature-block`, `linkedin`, and `web` as fact sources. But `buildFacts` only ever emits `source: "email"`, and no code parses signature blocks. Net effect: **Company is permanently blank, and every AI brief says "Company: unknown".** Dead schema plus an unbacked doc claim.

**d) Every fact is `applied: true`.** The README defines `applied` as *"Whether written into contact/deal record"* — but nothing is ever written into the record, and the field is a constant `true`. The concept is unimplemented.

**e) Only INBOUND mail is ever imported.** The Gmail query is `in:inbox`, and `runPipeline` hardcodes `direction: "INBOUND"`. So `EmailDirection.OUTBOUND`, the direction badge logic, and the `[OUTBOUND]` branch of `formatEmails` are all dead. The AI brief promises *"What they last said"* — but it can never see what *you* said, because your replies are never imported. Sent mail would materially improve brief and nudge quality (e.g. "you already quoted $8k on the 12th").

**f) `in:inbox` alone.** No `-in:chats`, and no thread-level grouping in the UI despite `Email.threadId` being stored. Replies that Gmail auto-archives are missed.

**g) Concurrent imports aren't guarded.** The dedupe check (`prisma.email.findUnique`) sits *outside* the transaction. Two simultaneous runs both pass the check, then one hits the unique constraint inside the transaction → whole transaction rolls back → a spurious error in `errors[]`. Safe, but noisy, and a double-clicked "Import Gmail" button triggers it. Add an in-process per-user lock or make the import idempotent by upsert.

---

### 4.7 🟠 Rate limiting is soft, and the most expensive endpoint has none

**File:** `src/lib/rate-limit.ts`

The limiter is a module-level `Map`. On Vercel, each serverless instance has its own map, so the effective limit is `limit × live instances`, and it resets on every cold start. The file's own comment is honest about this and says to swap in Upstash Redis "before scaling" — fine as a known trade-off for a solo deployment.

The real problem is **coverage**. Rate limits are applied to the four `/api/ai/*` routes only. **`importGmailAction` — a server action that fans out to Gmail's API, up to 250 `format=full` message fetches per invocation — has no limit at all.** A user (or a stuck client) can hammer it freely, burning Gmail quota and DB writes. Add a limit on the same interface; the key is already available (`user.id`).

Also: the limiter throws synchronously from inside a `try`, which is correct, but there's no `Retry-After` on the server-action path (actions return `{ ok, message }` and lose the header). Not fatal.

---

### 4.8 🟠 Cron will time out and fail partially, silently

**Files:** `src/app/api/cron/stale-followups/route.ts`, `src/lib/scheduler.ts`

`maxDuration = 60`, and `scheduleFollowUpsAllUsers` iterates users **sequentially**, calling `scheduleFollowUpsForUser` → `listStaleDeals` (which is itself N+1, see §5.1) → `generateFollowUpNudge` (a Gemini call) **per stale deal**.

With 1 Gemini call ≈ 1–3s, ~20–40 stale deals exhausts the budget. On timeout the function is killed mid-loop: some tasks are created, some aren't, and because Vercel cron timeouts surface as a platform error (not the handler's JSON), the partial state is invisible.

**Fix:** process in bounded-concurrency batches, persist progress, and return early with a `hasMore` flag so the next run continues. Or move to a queue. At minimum, log which users were completed.

---

### 4.9 🟠 Unhandled RLS regression + no FORCE ROW LEVEL SECURITY

**File:** `prisma/rls-lockdown.sql` (merged as PR #1)

The script is correct as written and its reasoning is sound — the comment explicitly explains why `FORCE ROW LEVEL SECURITY` is deliberately *not* used (Prisma connects as the table owner, so forcing it would lock the app out). Good.

The problem is **process**: it's a one-shot `DO` block that iterates `pg_tables` *as they exist at run time*. Combined with §4.4 (no migrations), this means:

- nothing guarantees it was ever run against prod;
- **every new table created later by `prisma db push` is created with RLS disabled** — silent, permanent regression of the exact exposure Supabase's advisor flagged.

**Fix:** convert it to a migration (see §4.4) so it runs on every deploy, or add an `ALTER DEFAULT PRIVILEGES`-style hook. Also note the honest limitation worth documenting: because Prisma uses the owner role, RLS here protects only Supabase's `anon`/`authenticated` PostgREST path — a leaked `DATABASE_URL` still grants full read. That's a reasonable posture; it just shouldn't be mistaken for defence against credential compromise.

---

### 4.10 🟠 `SETUP.md` is materially wrong

`SETUP.md` will actively mislead anyone setting this up:

| Line | Says | Reality |
|---|---|---|
| 75 | `OPENAI_API_KEY` | App uses **`GEMINI_API_KEY`** (`src/lib/ai/gemini.ts`) |
| 90 | `NEXTAUTH_URL` | App uses **`BETTER_AUTH_URL`** |
| 84–87 | Vercel + **Neon** | Actual prod is **Supabase** (Singapore) per the session log |
| 65 | *"the first check records the current time and imports nothing before it"* | First run backfills **the last 24 hours** (`getImportContext`) |
| env table | omits `CRON_SECRET`, `GEMINI_API_KEY`, all `SENTRY_*` | All are read by the code |
| 76 | `STRIPE_SECRET_KEY` | No code reads it; billing explicitly deferred |

The README's env tables are correct; `SETUP.md` is the stale one. It reads like a pre-pivot draft that was never reconciled after the OpenAI→Gemini and NextAuth→better-auth changes.

---

## 5. Findings — P2 (performance, scale, correctness edge cases)

### 5.1 🟡 N+1 queries on the board's hot path

`src/app/board/page.tsx` calls `listStaleDeals(user.id, 5)` on **every board render**. That function loads all `INBOX`/`QUALIFIED` deals, then calls `loadDealContext()` **per deal**, and each `loadDealContext` issues two queries (deal+contact+user, then up to 20 emails). So a single `/board` view costs roughly **2N + 3 round trips** for N open deals — at 200 deals, 400+ queries per page load, and it's a server component so it's on the critical path.

**Fix:** compute staleness in SQL. `lastActivity` is `max(lastContact, newest email.receivedAt, deal.createdAt)` — expressible as a single `groupBy`/`_max` aggregate, or a raw query. Then one query replaces the whole loop.

### 5.2 🟡 No pagination anywhere

- Board loads **every** deal for the user.
- Deal detail hardcodes `take: 20` on emails — silently truncating long threads with no "load more".
- `facts` and `tasks` are unbounded.
- `listStaleDeals` is unbounded.

Fine at 20 deals, uncomfortable at 500. The `take: 20` on emails is the worst of these because it's invisible to the user.

### 5.3 🟡 SSE stream drops the final buffer

**File:** `src/lib/ai/gemini.ts` — `sseToPlainText()`

The `TransformStream` maintains a `buffer` and processes only complete lines (`buffer.split("\n")` → `lines.pop()`). It defines **no `flush()`**. If the upstream response ends without a trailing newline, the last `data:` frame sits in `buffer` and is discarded — the generation is silently truncated by one chunk.

Low probability, high annoyance, and it's the classic "why is the last sentence missing" bug class. Add a `flush(controller)` that processes the remaining buffer.

### 5.4 🟡 `nextMorningAt9()` uses server-local time

`src/lib/scheduler.ts` does `dueAt.setHours(9, 0, 0, 0)` on the server. On Vercel that's UTC — so a follow-up "scheduled for 9am" fires at 9am UTC, which for the target user (a freelancer, likely in a specific timezone) may be 2am or 5pm. There's no timezone field on `User`. Small, but it's a personal-product correctness issue.

### 5.5 🟡 Dynamic Tailwind classes are silently unstyled

**File:** `src/app/board/[dealId]/deal-detail-client.tsx:443`

```tsx
className={`inline-block rounded-full bg-${email.direction === "INBOUND" ? "sky" : "violet"}-50
            text-${email.direction === "INBOUND" ? "sky" : "violet"}-700 px-2 py-0.5 ...`}
```

Tailwind's scanner is **static** — it greps source for literal class strings. `bg-${...}-50` never appears literally, so `bg-sky-50`, `bg-violet-50`, `text-sky-700`, `text-violet-700` are **never generated**. The direction badge renders with no background or colour.

**Fix:** a lookup map, which is also what the rest of the codebase already does (`STAGE_COLORS`):

```tsx
const DIRECTION_COLORS = {
  INBOUND: "bg-sky-50 text-sky-700",
  OUTBOUND: "bg-violet-50 text-violet-700",
} as const;
```

(This is currently the only such instance — `grep` for `bg-${` / `text-${` / `border-${` returns one hit.)

### 5.6 🟡 Dark mode is half-implemented and looks broken

`src/app/globals.css:15–20` flips `--background` to `#0a0a0a` under `prefers-color-scheme: dark`. But every component hardcodes `bg-zinc-50`, `bg-white`, `text-zinc-900`, `border-zinc-200`. Result in dark mode: a near-black page background behind stark white cards with dark text, and a white nav bar — inconsistent, and worse than no dark mode at all.

**Fix:** either delete the media query (commit to light-only, which suits the zinc/white design) or add `dark:` variants throughout. The current state is the worst option.

### 5.7 🟡 Client-side Sentry init is dead code

**File:** `src/instrumentation.ts`

`register()` executes in the **server** runtime, where `typeof window !== "undefined"` is always `false`. So the `unhandledrejection` and `error` listeners inside it never attach.

Meanwhile `sentry.client.config.ts` exists and *does* init the browser SDK plus `onRouterTransitionStart`. With `@sentry/nextjs` v10 the convention moved to `instrumentation-client.ts`, so it's ambiguous which of the two mechanisms is actually live — and the `beforeSend` filter (which drops 429s and `NEXT_REDIRECT` noise) only takes effect if the client config loads.

**Fix:** consolidate on the v10 convention, delete the dead `window` block from `instrumentation.ts`, and confirm in a browser that a thrown error reaches Sentry.

### 5.8 🟡 Missing security headers: no CSP, no HSTS

`next.config.ts` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`. Good. Missing:

- **`Strict-Transport-Security`** — no HSTS on a site handling Gmail content.
- **`Content-Security-Policy`** — for an app that renders imported email bodies into the DOM, a CSP is the main defence-in-depth against XSS. `X-Frame-Options` covers framing but not injection.

React escapes by default and the email body is rendered as a text child (`{email.body}`), so there's no immediate XSS vector — but a CSP is cheap and this app's threat model (arbitrary third-party HTML-adjacent content) argues for it.

---

## 6. Findings — P3 (code quality, testing, DX)

### 6.1 Testing: the "24 unit tests" overstate coverage

`src/lib/pipeline.test.ts` (9 assertions), `src/lib/logger.test.ts` (9), `src/lib/ai/context.test.ts` (5) — all target **pure utility functions**: `parseFrom`, `truncate`, `formatEmails`, and the logger's JSON shape. `vitest.setup.ts` mocks Prisma so heavily that nothing in the unit suite touches real logic.

Meanwhile the pieces most likely to break silently have **no tests at all**:

- `decodeBase64Url` / `extractBody` — the HTML-dropping bug in §4.2 would have been caught by one test with a `multipart/alternative` fixture.
- `sseToPlainText` — the dropped-final-buffer bug in §5.3.
- `aiErrorResponse` — the `instanceof` mapping chain.
- `rateLimit` — window rollover and the `Retry-After` computation.
- `buildFacts` — the keyword heuristics.
- `getImportContext` / boundary logic — **the §4.1 data-loss bug**.

The integration tests are the strong half: `context-scope.test.ts` locks IDOR, `pipeline.test.ts` covers staging/dedupe/isolation, `scheduler.test.ts` asserts no duplicate tasks. Those are the right risks. Extend that instinct to the pure functions above.

**Also:** `vitest.setup.ts:19` mocks `next-auth/react` — the app uses `better-auth`. Leftover from a migration; harmless but a drift signal.

### 6.2 CI's typecheck job doesn't generate the Prisma client

**File:** `.github/workflows/ci.yml`

The `test` and `build` jobs both run `npm run db:generate`. The **`lint-and-typecheck` job does not**. Without generation, `@prisma/client` resolves to its stub, whose types are permissive — so `npm run typecheck` can pass **vacuously**, failing to catch exactly the Prisma type errors it exists to catch.

**Fix:** add `npm run db:generate` to the `lint-and-typecheck` job before `npm run typecheck`.

### 6.3 Error messages leak to the client outside the AI routes

The README and session log advertise "sanitized errors". That's true for `/api/ai/*` (via `aiErrorResponse`), but **not** for the server actions, which return raw `err.message`:

- `src/app/board/actions.ts` — `importGmailAction` returns `err.message` directly
- `src/app/settings/actions.ts` — `updateRateCardAction` returns `err.message`
- `src/app/board/[dealId]/task-actions.ts` — all three actions
- `src/app/board/[dealId]/actions.ts` — all three AI actions

A Prisma failure surfaces as e.g. *"Unique constraint failed on the fields: (`userId`,`gmailId`)"* in the UI. **Fix:** route these through the existing `AppError` hierarchy and return `err.message` only for `AppError` instances; log the rest and return a generic string.

### 6.4 Non-streaming AI path loses the typed error

`generateDealBrief`, `generateFollowUpNudge`, and `generateProposalDraft` all do:

```ts
catch (err) {
  if (err instanceof AiUnavailableError) throw err;
  throw new Error(`Brief generation failed: ${(err as Error).message}`);
}
```

Wrapping in a plain `Error` destroys the `GeminiApiError` type, so `aiErrorResponse` can no longer map a Gemini 429/500 to `502` — it falls through to the generic `500`. The streaming variants don't do this, so the two paths behave differently. Currently low-impact (the non-streaming functions are only reachable from the dead actions in §4.5), but it's a latent trap.

### 6.5 Smaller items

| Item | Location | Note |
|---|---|---|
| `User.gmailSyncStartedAt` misnamed | `schema.prisma` | Stores the *last imported boundary* and is rewritten every run, but the name says "sync started at". Rename to `gmailImportBoundaryAt`. The UI already calls it "boundary". |
| `Account` missing `@@unique([providerId, accountId])` | `schema.prisma` | `better-auth` expects this for correct account linking; without it, duplicate Google accounts per user are possible. |
| `/api/health` version is always `0.1.0` | `api/health/route.ts` | Reads `npm_package_version`, which is unset on Vercel. |
| Unpinned Vercel CLI in CI | `.github/workflows/ci.yml` | `npx --yes vercel@latest` — and the commit log shows they already lost time to CI deploy tooling churn (`476b5c3`, `d6053fc`). Pin it. |
| `isNetworkError` string-matches `"fetch"` | `src/lib/retry.ts` | Works today (`TypeError: fetch failed`), fragile. Prefer `err instanceof TypeError && "cause" in err`. |
| `listStaleDeals` sorts by `updatedAt` then re-sorts by `idleDays` | `src/lib/ai/nudge.ts` | The first ordering is discarded; drop it. |
| No `robots.txt` / `sitemap` | `public/` | `/sign-in` and legal pages are publicly indexable. |
| No `LICENSE`, no `SECURITY.md` | repo root | Public repo with **no license** = all rights reserved by default. Matters if it's meant to be used. |
| `skills-lock.json` at root | repo root | Unexplained tooling artifact. |
| `README.md` §5 documents `signature-block`/`linkedin`/`web` fact sources | `README.md` | None are implemented (see §4.6c). |
| `README.md` §7 documents manual task creation | `README.md` | Not implemented (see §4.5). |
| `STRIPE_SECRET_KEY` in docs + `pre-deploy.sh` optional vars | multiple | No code reads it. |
| `AGENTS.md` is auto-regenerated by `next dev` | `AGENTS.md` | Committing it is intentional per its own text; fine, just noisy. |

---

## 7. Dead-code inventory

**~180 lines of exported code with zero callers.** Verified by grep across `src/`.

```
src/app/board/[dealId]/task-actions.ts        3 actions   (createTask/completeTask/deleteTask)
src/app/board/[dealId]/schedule-actions.ts    1 action    (scheduleStaleFollowUps)
src/app/board/[dealId]/actions.ts             3 actions   (generateBrief/Proposal/Nudge — non-streaming)
src/components/error-boundary.tsx             whole file
src/lib/logger.ts                             createLogger()
src/lib/ai/context.ts                         PROPOSAL_STAGES
src/lib/ai/gemini.ts                          geminiConfigured()
```

The `board/[dealId]/actions.ts` trio is *superseded* — the client calls `/api/ai/*` streaming routes instead — so it's genuinely removable. The `task-actions.ts` trio is *unwired*, which is a different problem: the functionality is wanted (the README documents it) but the UI was never built.

Deleting dead code is cheap and removes the false impression of a complete feature set. Note that `task-actions.ts` and `schedule-actions.ts` are *also* mocked in `vitest.setup.ts`, which is why their deadness wasn't obvious.

---

## 8. Prioritized roadmap

### Do first — correctness and data safety (days, not weeks)

1. **Fix the 250-message boundary jump** (§4.1) — this is silent, permanent data loss in the product's core function.
2. **Add HTML body extraction** (§4.2) — unblocks AI quality and the reading experience.
3. **Reconcile backup/restore** (§4.3) and add a CI round-trip test.
4. **Adopt Prisma migrations** (§4.4) and convert `rls-lockdown.sql` into one, so RLS can't regress.
5. **Fix the `pre-deploy.sh` chain** — `migrate status`, `db execute` flags, missing `generate`.
6. **Add `npm run db:generate` to the CI typecheck job** (§6.2).
7. **Stop returning raw `err.message`** from server actions (§6.3).

### Then — close the product/reality gap

8. **Decide the UI scope** (§4.5): either wire task CRUD + deal/contact editing + fact accept/reject, or strip the claims from the README and delete the dead actions. Pick one; the current middle state is the worst of both.
9. **Fix `Deal.value`** — add an edit affordance, otherwise every AI prompt says "unknown" forever.
10. **Populate `Contact.company` / `linkedinUrl`** from signature blocks (§4.6c), or remove the fields and the doc claims.
11. **Fix the dynamic Tailwind classes** (§5.5) — a 5-line lookup map.
12. **Resolve dark mode** (§5.6) — remove or complete.
13. **Import sent mail** (§4.6e) so briefs can see both sides of the thread.
14. **Rewrite `SETUP.md`** (§4.10).

### Then — scale and hardening

15. **De-collapse the board's N+1** (§5.1) — one aggregate query.
16. **Add pagination** (§5.2), starting with the silent `take: 20` on emails.
17. **Batch the cron** with bounded concurrency + resumability (§4.8).
18. **Rate-limit `importGmailAction`** (§4.7); move the limiter to Redis when a second instance appears.
19. **Add CSP + HSTS** (§5.8).
20. **Fix the SSE `flush()`** (§5.3) and consolidate Sentry client init (§5.7).
21. **Add unit tests** for `extractBody`, `sseToPlainText`, `aiErrorResponse`, `rateLimit`, `buildFacts`, and the boundary logic (§6.1).
22. **Add account deletion + data export** — the privacy policy promises both; neither exists. Required before any public launch.
23. **Add a `LICENSE`** and `SECURITY.md`.

### Product decisions to make deliberately

- **Repeat business**: keep "one deal per contact forever" (§4.6a) or model recurring engagements?
- **`gmail.readonly` restricted scope**: CASA Tier 2 assessment vs waitlist-first launch. Already flagged in the session log; it's a real gate on public availability, not a code problem.
- **Billing**: `STRIPE_SECRET_KEY` is documented but unimplemented. Either commit or remove from docs.

---

## 9. Verification status

**What I confirmed by reading the code directly** (all findings above are grounded in source, not inference): route protection and ownership scoping; the boundary-advance logic; `extractBody`'s `text/plain`-only branch; the dead-code set (by grep for every exported symbol); the backup/restore filename and directory mismatch; the absence of `prisma/migrations/`; the CI job step lists; the `SETUP.md` vs code env-var drift; the dynamic Tailwind class at `deal-detail-client.tsx:443`.

**What I could not execute:**

- `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` — dependency installation is blocked in this sandbox: `npm ci` fails with `CODEBUDDY_BROKER_DENY: Brokered host mkdir requires an available runtime file rule`, and without `node_modules` neither `prisma generate` nor `tsc` can run. **The README's "lint + typecheck + production build all green" claim is therefore unverified here** — the CI config and commit history make it plausible, and nothing I read contradicts it. Note the CI gap in §6.2, which means even a green CI typecheck is weaker evidence than it appears.
- `npm run test:int` — needs a live PostgreSQL.
- Anything requiring `DATABASE_URL`, Gmail credentials, or a Gemini key.

**Consequence for confidence:** every finding above is a *static* finding — read directly from source, not inferred from a runtime failure. The behavioural claims I'm most confident in are §4.1 (the arithmetic of `maxPages × pageSize` vs. the boundary reduce is unambiguous), §4.2 (`extractBody`'s only `text/plain` branch), §4.3 (two literal filename/directory mismatches), §4.4 (`prisma/migrations/` does not exist), and §4.5/§5.5 (verified by grep). The claims that would benefit most from a live run are §5.1 (actual query counts) and §5.3 (whether Gemini ever omits the trailing newline).

**Local artifacts:** repo cloned to `./freelance-crm` at `47bc617`. A prior failed clone was preserved as `./freelance-crm.broken-clone-backup` (it contained only a broken `.git` skeleton with `HEAD → refs/heads/.invalid` and no working tree, so nothing was lost).

**To reproduce the P0 findings quickly:**
- §4.1: read `src/lib/gmail.ts` `fetchNewMessages` (`maxPages = 10`, `pageSize = 25`) alongside the `newestFetched` reduce in `src/lib/pipeline.ts`.
- §4.2: unit-test `extractBody` with a `multipart/alternative` payload that has only `text/html`.
- §4.3: `BACKUP_DIR=./backups ./scripts/backup-db.sh` then `./scripts/restore-db.sh` — the second fails to find the first's output.
- §4.4: `npx prisma migrate status` on a clean checkout.
