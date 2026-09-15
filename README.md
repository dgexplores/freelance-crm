# freelance-crm

*Your deals manage themselves.*

---

## TL;DR

A pipeline CRM for **solo freelancers and consultants** that reads your Gmail (read-only), turns inbound threads into a deal board with evidence, and writes your pre-call briefs, proposals, and follow-ups from your rate card. Zero data entry. No guessing.

---

## Status

**🟢 Deployed to production:** https://freelance-crm-xi.vercel.app

### Done
- **Security hardening** — IDOR closed (session + owner scoping on every AI route, locked by a regression test), rate limiting on AI endpoints *and* on the expensive Gmail import, typed error hierarchy, sanitized errors on every server action, Gemini key moved to headers
- **Reliability** — retry with backoff on Gmail/Gemini failures, atomic per-message DB staging, forward-sync boundary that can never skip unfetched mail, DB hot-path indexes, session-less cron scheduler that actually works, SSE stream flush fixed
- **Product UX** — drag-and-drop kanban with optimistic moves, streaming AI output (shimmer → typewriter → result card), motion design with `prefers-reduced-motion` support, working task CRUD, manual deal/contact editing, fact review
- **Correctness** — HTML-only email bodies are converted to text instead of falling back to a 200-char snippet; `Deal.value` and contact company/LinkedIn are editable
- **Findability** — board search across deals, contacts, evidence and subject lines; stage filter; "needs follow-up" filter; sort by recency, value or idleness; open/won/lost totals
- **Depth** — the full email thread is reachable via "load older emails" (the page used to stop at the newest 20 with no way back)
- **Data ownership** — self-serve JSON export and account deletion, so the privacy policy's promise no longer depends on emailing support
- **Quality gates** — unit tests + 10 Postgres integration tests in CI on every push, plus a backup/restore round-trip test; lint + typecheck + production build
- **Ops** — Dockerfile + prod compose stack, `vercel.json` cron, a backup/restore pair that actually round-trips, a pre-deploy script that can pass, RLS verification, privacy policy + terms pages
- **Infrastructure** — Supabase Postgres provisioned; Vercel project deployed with auth/cron/DB secrets wired

### Left
| Item | Who |
|------|-----|
| Google OAuth keys (`GOOGLE_CLIENT_ID`/`SECRET`) → Vercel env | Owner |
| Gemini key (`GEMINI_API_KEY`) → Vercel env | Owner |
| Redeploy after keys → full end-to-end loop | Either |
| Adopt Prisma migrations (`npm run db:baseline`, see SETUP.md §7) | Either |
| Import sent mail so briefs see both sides of a thread | Backlog |
| Onboarding checklist · Redis-backed limits · Playwright E2E · signature-block parsing | Backlog |
| Persist AI outputs (regenerating on every click costs tokens and loses history) | Backlog |
| `gmail.readonly` restricted-scope strategy before public launch (CASA assessment vs waitlist-first) | Decision needed |
| Stripe billing + AI usage metering | Deferred by owner |

See [Known limitations](#known-limitations) for what this deliberately does not do.

Full delivery record: [FREELANCE-CRM-SESSION-LOG.md](./FREELANCE-CRM-SESSION-LOG.md).

---

## Who This Is For

| You | This Helps You |
|-----|----------------|
| **Solo consultant/freelancer** selling expertise (dev, design, strategy, writing, etc.) | Stop copying emails into Notion/Sheets. Pipeline builds itself. |
| **Too busy selling to log anything** | CRM is a side effect of email, not a chore before it. |
| **Wants trustworthy records** | Every fact is sourced (email, signature block) and graded (strong/suggestion). No hallucinations. |
| **Sends proposals manually** | Rate card + thread context → professional draft in seconds. |
| **Lets deals go cold** | Auto-schedules follow-ups with reasons. Nothing falls through. |
| **Self-hosts or deploys to Vercel** | Lean stack: Next.js + Postgres + one LLM. Cheap to run. |

**Not for:** Sales teams, multi-user CRMs, lead enrichment from LinkedIn/web, complex forecasting dashboards.

---

## How It Works (The Loop)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Inbound    │────▶│  Auto-      │────▶│  Deal Board │────▶│  Pre-Call   │────▶│  Proposal   │
│  Email      │     │  Pipeline   │     │  (Kanban)   │     │  Brief      │     │  Draft      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼                   ▼
  Read-only          Evidence on         Drag cards          AI: who they      AI: scope +
  Gmail API          every card          between stages      are, what they    fees from rate
  (gmail.readonly)   (whyInPipeline)     (INBOX→WON)         said, what to     card only
  Forward-only       Strong/suggestion   Stale badges        confirm           Never invents
  boundary           facts only                                                        prices
                                                                                      │
                                                                                      ▼
                                                                              ┌─────────────┐
                                                                              │  Follow-Up  │
                                                                              │  Nudge      │
                                                                              └─────────────┘
                                                                                     │
                                                                                     ▼
                                                                              Auto-scheduled for
                                                                              stale deals (≥5d)
```

---

## Core Features

### 1. Pipeline Board (`/board`)
- **5 stages:** INBOX → QUALIFIED → PROPOSAL → WON / LOST
- **Evidence on every card** — `whyInPipeline` shows the exact email that created the deal
- **Move with one click** — Forward/back buttons, Won/Lost from PROPOSAL, Reopen from closed
- **Stale indicator** — Amber badge shows deals idle ≥5 days in INBOX/QUALIFIED
- **Gmail Import button** — Forward-only, read-only sync (never touches old mail)

### 2. Deal Detail (`/board/[dealId]`)
Four tabs:
| Tab | What You See |
|-----|--------------|
| **Overview** | Deal metadata, evidence, AI actions (Brief, Proposal, Nudge) |
| **Emails** | Full thread history (newest first), open in Gmail link |
| **Facts** | Evidence ledger: claim + source + strength (strong/suggestion) + applied |
| **Tasks** | Scheduled follow-ups, briefs, proposals with due dates |

### 3. AI Actions (Powered by Your Rate Card)
| Action | When | Output |
|--------|------|--------|
| **Pre-Call Brief** | Any deal, before a call | Who they are, what they last said, where deal stands, what to confirm, talking points |
| **Proposal Draft** | PROPOSAL-stage deals | Scope, fees (from rate card only), terms, next steps — never invents prices |
| **Follow-Up Nudge** | Stale INBOX/QUALIFIED deals | Short, human re-engagement email referencing thread context |

**All AI outputs:** Copy-to-clipboard, markdown, editable before sending.

### 4. Rate Card (`/settings`)
Markdown editor with default template:
```markdown
## Services
| Service | Rate | Unit |
|---------|------|------|
| Strategy / Discovery | $250 | hour |
| Frontend Development | $180 | hour |

## Terms
- Minimum engagement: 20 hours
- Payment: Net 15, 50% upfront
- Scope changes: Billed at hourly rate
```
Powers **all AI features** — briefs reference your services, proposals pull fees verbatim.

### 5. Evidence Ledger (Facts)
Every claim extracted from emails:
- **Claim** — Literal statement from the email text
- **Source** — `email`. Signature-block, LinkedIn, and web enrichment are **not** implemented.
- **Strength** — `strong` (directly stated) or `suggestion` (keyword heuristic)
- **Applied** — Toggle it in the Facts tab to mark whether the claim should count

*No guessing. Confidently wrong facts are worse than blank fields.*

### 6. Manual correction
The importer only ever *infers*. Everything it infers can be corrected by hand, because a
record you cannot fix is not a record you can trust:
- **Deal** — title, estimated value, lost reason (Edit on the Overview tab)
- **Contact** — name, company, LinkedIn URL (Edit on the contact card)
- **Facts** — apply / unapply
- **Tasks** — create, complete, reopen, delete

`Deal.value` is never guessed by the importer, so fill it in if you want value-aware
briefs and proposals — otherwise the AI is told the value is unknown.

### 7. Gmail Sync
- **Read-only** (`gmail.readonly` scope) — never sends, moves, archives, deletes
- **Forward-only** — first import reads ≤24h back, then records a boundary; older mail is never imported
- **Per-user boundary** — stored on `User.gmailSyncStartedAt`, only advances after a successful run
- **Never advances past unfetched mail** — a truncated fetch advances to the *oldest* message seen and says so
- **Deduplication** — one contact per (user, email); one deal per contact

### 8. Task Scheduling + Cron
- **Manual:** create follow-up / brief / proposal tasks from the deal's Tasks tab
- **On demand:** the amber "N deals need follow-up" chip on the board schedules them now
- **Automatic:** `GET /api/cron/stale-followups` (daily cron) schedules follow-ups for deals idle ≥5 days
- **Each task carries a reason** — you decide if it still matters

### 9. Finding Things
The board is searchable, because scrolling five columns is not a strategy:
- **Search** — one box across deal title, contact name, contact email, the evidence line, the
  latest subject line and the sender. Multiple words all have to match, so `acme retainer`
  narrows instead of widening.
- **Stage chips** — All / INBOX / QUALIFIED / PROPOSAL / WON / LOST. When a filter is active each
  column shows `shown/total` rather than silently changing the meaning of its count.
- **Needs follow-up** — shows only the deals the staleness rule flags, using the *same* rule as
  the server's badge, so the number and the filter can never disagree.
- **Sort** — recent activity, deal value (unpriced last), or most idle.
- **Totals** — open pipeline value, won value, lost count, and how many open deals still have no
  value set (the importer never guesses one).

### 10. Full Thread History
The Emails tab loads the newest 20 messages, then **Load older emails** pages further back —
20 at a time, scoped to the deal's contact and to your account. A long thread is no longer
truncated with no way to see the rest.

### 11. Your Data
- **Export** — `GET /api/account/export` downloads a JSON file with your profile, rate card,
  contacts, deals, emails, facts and tasks. OAuth tokens are deliberately excluded: they are
  credentials, not data, and writing live refresh tokens to a file on disk would turn data
  portability into a leak.
- **Delete** — settings → *Your data* → type `DELETE` to erase the account and everything in it.
  Runs in a single transaction, children first, so a mid-way failure leaves the account intact
  rather than half-deleted.

---

## Known limitations

Things this does not do, stated plainly so nobody is surprised by them.

| Limitation | Detail |
|---|---|
| **Backlog ceiling** | One import run fetches at most 2,500 messages. Beyond that the boundary advances only to the oldest message fetched, and the import reports that older mail in the window was skipped. Only reachable if you don't run the app for a long time. |
| **Outbound mail is not imported** | The Gmail query is `in:inbox`, so only inbound messages exist. Briefs describe what *they* said, never what you replied. |
| **One deal per contact, forever** | A returning client does not get a new deal; the existing one is reused. Deliberate for now, but it means repeat business is not modelled. |
| **Deal titles freeze** | A deal keeps the subject line of the email that created it. |
| **Company / LinkedIn are manual** | Nothing parses signature blocks. These fields only populate if you type them in. |
| **AI output is not persisted** | Briefs, proposals and nudges are regenerated on each click, so history is lost and every click costs tokens. |
| **Search is client-side** | Filtering happens in the browser over the deals already loaded, so it stays instant but does not search mail bodies or reach past the loaded set. |
| **Rate limits are per-instance** | The limiter is in-memory, so on serverless the effective limit is per running instance. Swap in Redis before this is multi-tenant. |
| **`gmail.readonly` is a restricted scope** | Google requires a CASA Tier 2 assessment before public launch. A waitlist-first launch avoids it. |
| **Stale follow-ups fire at 09:00 UTC** | Not the user's local 09:00; there is no per-user timezone. |

---

## Quick Start

### Prerequisites
- Node.js 22+
- Docker (for local PostgreSQL)
- Google Cloud project with Gmail API enabled

### Local Development
```bash
# Clone and install
git clone git@github.com:dgexplores/freelance-crm.git
cd freelance-crm
npm install

# Start database
docker compose up -d

# Set up environment
cp .env.example .env
# Edit .env with your credentials (see below)

# Initialize database
npm run db:generate
npm run db:push

# Run development server
npm run dev
```
App runs at `http://localhost:3000`

### Required Environment Variables (Local)
| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://freelance:freelance@localhost:5432/freelance` (default) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |

### Optional (for AI features)
| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google AI Studio key for briefs/proposals/nudges |
| `CRON_SECRET` | `openssl rand -base64 32` (for scheduled follow-ups) |

See [SETUP.md](./SETUP.md) for Google OAuth setup details.

---

## Production Deployment

### Vercel + Supabase (Recommended)
1. Create a Supabase project (region: Singapore is closest to the current deployment)
2. Copy the **pooled** connection string (port `6543`, `?pgbouncer=true`) into `DATABASE_URL`
3. `DATABASE_URL="<supabase>" npm run db:push`
4. `DATABASE_URL="<supabase>" npm run db:rls` — re-apply `prisma/rls-lockdown.sql`
5. Import repo to Vercel
6. Add **all** environment variables (see below)
7. Add production redirect URI to Google OAuth: `https://your-domain.com/api/auth/callback/google`
8. Deploy

> **Why step 4 matters:** Supabase exposes `public` over its PostgREST API. Prisma
> creates tables with RLS *disabled*, so a `db push` can silently make the
> `User`/`Deal`/`Email` tables world-readable to anyone holding the anon key.
> `rls-lockdown.sql` turns RLS on for every table; `npm run predeploy` fails the
> build if any table is left exposed.

### Required Production Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase pooled URL) |
| `BETTER_AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Yes | Production URL (e.g., `https://your-domain.com`) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `CRON_SECRET` | Yes | `openssl rand -base64 32` (for `/api/cron/stale-followups`) |

### Recommended Production Variables
| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | AI features (briefs, proposals, nudges) |
| `SENTRY_DSN` | Error monitoring |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sentry source map upload |
| `SENTRY_ENVIRONMENT` | `production` (auto-set on Vercel) |

### Database Backups
`backup-db.sh` writes a `pg_restore` custom-format archive to
`$BACKUP_DIR/freelance-crm_<timestamp>.dump.gz` and verifies it is readable
before reporting success. `restore-db.sh` consumes exactly that filename
pattern and re-applies the RLS lockdown afterwards.

```bash
# Daily at 2 AM (cron has no useful cwd — use absolute paths)
0 2 * * * BACKUP_DIR=/var/backups/freelance-crm /path/to/scripts/backup-db.sh
```

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | — | Required. Passed straight to `pg_dump`; Supabase pooler URLs work as-is. |
| `BACKUP_DIR` | `./backups` | Must match the value used by `restore-db.sh`. |
| `RETENTION_DAYS` | `30` | Archives older than this are deleted after a successful run. |

Requires `pg_dump` / `pg_restore` (PostgreSQL client tools) on the host.

**Restore:**
```bash
DATABASE_URL="<target>" BACKUP_DIR=/var/backups/freelance-crm npm run restore:db
```
> Restoring drops and recreates the `public` schema. Point `DATABASE_URL` at the
> target database deliberately — never at the one you are currently serving from.

### Pre-Deployment Checklist
```bash
npm run predeploy
```
Runs, in order: required-env check → `db:generate` → typecheck → lint → tests →
build → DB connectivity → schema drift (`prisma migrate diff --exit-code`) →
RLS coverage. Set `SKIP_DB_CHECKS=1` to run only the local half.

> `db:generate` is not optional: without a generated Prisma client, `typecheck`
> resolves `@prisma/client` to its empty stub and passes vacuously.
>
> The drift step replaces `prisma migrate status`, which cannot work here — this
> project has no `prisma/migrations` directory, so that command always exited
> non-zero and made the script impossible to pass.

### Health Checks
- `GET /api/health` → `{ database: true, timestamp, version }` (200/503)
- Use with Vercel Health Checks, UptimeRobot, etc.

### Error Monitoring (Sentry)
1. Create Sentry project (Next.js)
2. Add Sentry env vars to Vercel
3. Source maps auto-upload on deploy
4. Errors captured with user context, release tracking, session replay

### Vercel Cron for Stale Follow-ups
In `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/stale-followups", "schedule": "0 9 * * *" }
  ]
}
```
Or external cron with `Authorization: Bearer ${CRON_SECRET}` header.

### Docker Production
```yaml
# docker-compose.prod.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=postgresql://freelance:freelance@db:5432/freelance
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - BETTER_AUTH_URL=https://your-domain.com
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - CRON_SECRET=${CRON_SECRET}
    depends_on: [db]
    restart: unless-stopped

  db:
    image: postgres:17-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    environment:
      POSTGRES_USER: freelance
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: freelance
    restart: unless-stopped

volumes:
  pgdata:
```

---

## Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run typecheck    # TypeScript strict check
npm run test         # Unit tests
npm run test:watch   # Watch mode
npm run test:int     # Integration tests (needs a real Postgres; skips if unreachable)

npm run db:push      # Push schema to DB (this project's normal path)
npm run db:generate  # Generate Prisma client
npm run db:studio    # Prisma Studio
npm run db:drift     # Show what differs between the live DB and schema.prisma
npm run db:rls       # Re-apply row-level security (prisma/rls-lockdown.sql)
npm run db:baseline  # Generate a baseline migration (one-off; see SETUP.md §7)

npm run predeploy    # Full pre-deployment validation
npm run backup:db    # Database backup  -> $BACKUP_DIR/freelance-crm_<ts>.dump.gz
npm run restore:db   # Restore the newest backup (prompts before dropping schema)
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack, React 19) |
| Language | TypeScript (strict: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`) |
| Database | PostgreSQL 17 + Prisma ORM |
| Auth | Better Auth (Google OAuth, `gmail.readonly` scope) |
| Email | Gmail API (read-only, forward-only) |
| AI | Google Gemini (briefs, proposals, nudges) |
| Styling | Tailwind CSS v4 |
| Testing | Vitest + React Testing Library |
| Error Tracking | Sentry (client/server/edge + instrumentation) |
| CI/CD | GitHub Actions → Vercel (lint, typecheck, test, build, deploy) |

---

## Project Structure

```
src/
├── app/
│   ├── (legal)/          # Privacy + Terms pages
│   ├── api/
│   │   ├── account/      # Self-serve data export (JSON download)
│   │   ├── ai/           # AI endpoints (brief, proposal, nudge, nudge/stale)
│   │   ├── auth/         # Better Auth catch-all
│   │   ├── cron/         # Scheduled jobs (stale follow-ups)
│   │   └── health/       # Health check endpoint
│   ├── board/            # Pipeline board + deal detail (+ server actions)
│   ├── settings/         # Rate card, data export/delete, account settings
│   └── sign-in/          # Auth page
├── components/           # Nav, skeletons
├── lib/
│   ├── ai/               # Prompts, context loader, Gemini client, HTTP error mapping
│   ├── account.ts        # Export payload + transactional account erasure
│   ├── account-constants.ts # Client-safe account constants
│   ├── auth.ts           # Better Auth config
│   ├── board-filter.ts   # Board search / filter / sort (pure)
│   ├── errors.ts         # Typed AppError hierarchy + safeActionMessage()
│   ├── gmail.ts          # Gmail API client (read-only, forward-only)
│   ├── pagination.ts     # Page sizes shared by pages and actions
│   ├── pipeline.ts       # Import & staging logic (dedupe, evidence, boundary)
│   ├── rate-limit.ts     # Fixed-window limiter (in-memory; swap for Redis)
│   ├── retry.ts          # Backoff + jitter, opt-in retry predicate
│   ├── scheduler.ts      # Session-less stale-follow-up scheduling
│   ├── staleness.ts      # The one "is this deal going quiet?" rule
│   ├── tasks.ts          # Task kinds (importable outside "use server")
│   ├── logger.ts         # Structured JSON logging
│   ├── prisma.ts         # Prisma client singleton
│   └── session.ts        # Server session helpers
├── instrumentation.ts    # Sentry server init
└── middleware.ts         # Auth protection for /board, /settings
```

---

## Data Model

| Model | Purpose |
|-------|---------|
| **User** | One person, rate card (markdown), Gmail sync boundary |
| **Contact** | Person, deduped by email per user, last contact timestamp |
| **Deal** | Pipeline entry: stage + `whyInPipeline` evidence + value |
| **Email** | Imported Gmail threads, direction, sentiment, action tags |
| **Task** | AI-scheduled: follow_up, brief, proposal with reason + due date |
| **Fact** | Evidence ledger: claim + source + strength (strong/suggestion) + applied |

---

## Pipeline Stages

```
INBOX → QUALIFIED → PROPOSAL → WON / LOST
```

- **INBOX** — New inbound contact, auto-created from email
- **QUALIFIED** — Real opportunity, worth pursuing
- **PROPOSAL** — Proposal sent, awaiting response
- **WON** — Closed won
- **LOST** — Closed lost (with reason)

---

## Roadmap

- [x] Gmail OAuth + mailbox import (forward-only)
- [x] Deal board auto-populated from email signals
- [x] AI: pre-call brief, follow-up nudge, proposal draft
- [x] Rate card management, task scheduling
- [x] Production readiness audit + P0 hardening (2026-08)
- [x] Typed error hierarchy + per-user AI rate limiting
- [x] Streaming AI output (zero-dep SSE) + motion design pass
- [x] Drag-and-drop kanban (@dnd-kit) with optimistic updates
- [x] Integration test suite against real Postgres (CI-enforced)
- [x] Production infra: Supabase Postgres provisioned, Vercel project + secrets wired, Docker prod stack
- [ ] Stripe billing + per-user AI usage metering *(deferred by owner)*
- [ ] Persist AI outputs to database
- [ ] Onboarding checklist for first-run users
- [ ] Redis-backed rate limiting (multi-instance ready)
- [ ] E2E tests (Playwright) — integration layer done
- [ ] HTML → text extraction for HTML-only emails; outbound import
- [ ] Legal pages: replace placeholder contact info with real entity details
- [ ] Webhook support for real-time Gmail push (Gmail Pub/Sub)
- [ ] Pre-public-launch decision: `gmail.readonly` CASA assessment vs waitlist-first

---

## Production Readiness Audit — 2026-08

Independent senior-dev audit of the full codebase. Verdict at audit time: **solid MVP skeleton, not production-ready**. Three things broken on `main`, one critical security hole, and one non-code launch blocker.

> **Superseded (2026-09).** This section is a historical record of the August audit
> and is kept for context. A second review found five further P0 defects the first
> audit missed — HTML-only email bodies were discarded, one import run silently
> dropped everything past 250 messages, the forward boundary could advance past
> unfetched mail, the SSE stream dropped its final chunk, and `predeploy` could
> never pass. Those are fixed. Read this section as *how the code got here*, not
> as a description of the current tree.

### Corrected since this audit was written

These bullets stated problems that no longer exist; leaving them uncorrected would
misdescribe the code:

| Audit claim | Current reality |
|---|---|
| "no restore script and no tested DR drill" | `scripts/restore-db.sh` exists, re-applies RLS after the schema drop, and CI runs a backup→restore round-trip on every push. |
| "Error mapping in `src/lib/ai/http.ts` matches error message strings" | `aiErrorResponse` is `instanceof`-based over a typed `AppError` hierarchy; no message parsing anywhere. |
| "Streaming AI output — Vercel AI SDK `streamText`" | Streaming is a hand-rolled SSE reader over `streamGenerateContent?alt=sse` in `src/lib/ai/gemini.ts`. The Vercel AI SDK is not a dependency. |
| "Tests cover pure functions only (24)" | 55 unit tests across 6 files now, and `decideBoundaryAdvance` / `htmlToText` / the SSE parser all have regression tests. The 10 Postgres integration tests are unchanged. Still no E2E layer. |

### 🔴 Critical findings (P0 — fixed in this repo)

| # | Finding | Where | Status |
|---|---------|-------|--------|
| 1 | **IDOR / unauthenticated data exfiltration**: `/api/ai/brief`, `/api/ai/proposal`, `/api/ai/nudge` had no session check and loaded any deal by ID globally — an attacker could leak rate cards, contact emails, and thread contents through Gemini output | `src/app/api/ai/*`, `src/lib/ai/context.ts` | ✅ Fixed: session required, all queries scoped by `userId` |
| 2 | **Cron feature was dead code**: the cron route called a server action that requires a session user; cron requests have none, so nothing ever scheduled and it returned `200 ok:false` silently | `src/app/api/cron/stale-followups` | ✅ Fixed: dedicated scheduler module with session-less path |
| 3 | **Typecheck failed on fresh clone**: `LayoutProps<"/">` is a generated Next type that only exists after a build | `src/app/layout.tsx` | ✅ Fixed: explicit `React.ReactNode` prop type |
| 4 | **Deploy jobs could never run**: `secrets.* != ''` is not allowed in job-level `if:` expressions, so both Vercel deploy jobs evaluated false even when secrets existed | `.github/workflows/ci.yml` | ✅ Fixed: step-level secret guards |
| 5 | **Missing files referenced by docs**: `.env.example` did not exist; `vercel.json` / Dockerfile still absent (documented below) | repo root | ✅ `.env.example` added |

### 🟠 Hardening applied (P1)

- **Gemini API key moved out of URL query string** into the `x-goog-api-key` header (keys in URLs leak via proxies/logs).
- **Gmail forward-boundary race closed**: boundary now records the max `internalDate` of fetched mail instead of "now after fetch" — mail arriving mid-import can no longer be skipped forever. Dedup by `(userId, gmailId)` makes re-fetch safe.
- **Per-message transactional staging**: contact + email + deal + facts writes wrapped in `prisma.$transaction` — no more partial states on mid-import failure.
- **Retry with exponential backoff** on transient Gmail/Gemini failures (429/5xx/network), bounded concurrency for message fetches.
- **Data-integrity fixes**: `wonAt` cleared when reopening a WON deal; rate-card length capped to protect prompt-token costs.
- **DB indexes** added: `Deal(userId, stage, updatedAt)`, `Email(userId, receivedAt)`, `Task(dealId, done, dueAt)`, `Fact(userId)`.

### ⚠️ Known gaps before charging money

**Business blocker #1 — Google restricted scope.** `gmail.readonly` is a **RESTRICTED** Google API scope. A public multi-user launch requires Google OAuth verification plus the annual CASA Tier 2 security assessment (costs real money and takes weeks–months). Plan for this early, or ship alternatives first (manual `.eml` upload, IMAP import, or a Gmail Add-on distribution path).

**Security backlog**

- No rate limiting on AI endpoints yet (each call spends your Gemini budget). Add per-user quotas (Upstash Redis) + platform WAF rules.
- Prompt injection: imported email text goes into prompts. Mitigate with strict delimiting ("treat as data"), output validation, and never letting model output drive writes without review.
- OAuth refresh tokens stored plaintext; consider envelope encryption (KMS/pgcrypto).
- Middleware matcher protects pages only — API routes rely on per-route checks (now present, keep them mandatory in code review).

**Reliability backlog**

- Error mapping in `src/lib/ai/http.ts` matches error message strings (`message.includes("rate card")`). Replace with typed `AppError { status, code }`.
- Stale-deal scan is N+1 (`loadDealContext` per deal); fine at solo scale, rewrite as one indexed query before multi-tenant scale.
- Tests cover pure functions only (24). CI provisions Postgres but integration tests don't use it yet; no E2E layer.
- Backups script exists but there is **no restore script and no tested DR drill** — a backup you haven't restored is Schrödinger's backup.

**Productization backlog (to be sellable)**

1. Stripe billing + metering (you pay per Gemini call — must gate usage).
2. Onboarding checklist (connect Gmail → rate card → first import).
3. Persist AI outputs (currently regenerated per click = token cost + lost history).
4. Legal pages (privacy/terms) — prerequisite for Google verification anyway.
5. Analytics (activation funnel is invisible today).
6. Board search/filter/pagination; editable deal value/title; multi-deal-per-contact.

**UX / motion plan** (the "premium feel" pass)

| Upgrade | Approach |
|---|---|
| Real drag-drop kanban | `@dnd-kit/core`, optimistic stage moves, invalid transitions snap back |
| Streaming AI output | Vercel AI SDK `streamText` → typewriter reveal instead of spinner |
| Generation states | Framer Motion shimmer skeleton → streaming markdown → spring-in result card |
| Micro-interactions | Stage-change card slide, confetti on WON, count-up badges, staggered card entry |
| Feedback | Copy-button morph to checkmark, toast system replacing raw status lines |

### Priority order

```
P0 (done):        IDOR · cron auth · typecheck · CI deploy guards · .env.example
P1 (done):        key-in-header · transactions · backoff · boundary race · indexes · data fixes
P2 (done):        typed errors · rate limits · streaming AI + motion UI · dnd board
                  integration tests · legal pages · Docker stack · restore script
Deploy (done):    Supabase Postgres provisioned · Vercel production LIVE
                  https://freelance-crm-xi.vercel.app
Remaining keys:   GOOGLE_CLIENT_ID/SECRET + GEMINI_API_KEY → then OAuth works end-to-end
Backlog:          Stripe · persist AI outputs · onboarding · Redis limits · E2E · CASA decision
```

Full delivery record: see [FREELANCE-CRM-SESSION-LOG.md](./FREELANCE-CRM-SESSION-LOG.md).
The 2026-09 review that superseded this section: [CODE-REVIEW-2026-09.md](./CODE-REVIEW-2026-09.md).

---

## vs. Comp AI CRM (trycompai/crm)

| | Comp AI CRM | freelance-crm |
|---|---|---|
| **Persona** | B2B sales **teams** | **One freelancer/consultant** |
| **Scope** | Horizontal: contacts/companies/deals | Vertical: freelancer workflow only |
| **AI** | Research engine: enrich, web, LinkedIn, budgets | Sales execution: mail → pipeline → brief → proposal → nudge |
| **UX** | Dashboard-centric, Agent tab per record | Inbox-centric: lives in email thread, zero data entry |
| **Evidence** | Strong/suggestion from data vendors | Same rule, source = your email + signature blocks |
| **Ops** | Vercel AI Gateway, Perplexity, RapidAPI, sandbox | Lean: Gmail OAuth + one LLM. Cheap to run anywhere |
| **Business** | Open source, self-host | Self-serve, Stripe, built for paying solo users |

*Same bones, different muscle: the no-guess-facts rule stays, the research engine goes, and the closed inbox → deal loop is the product.*

---

## License

MIT