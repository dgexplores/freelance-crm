# freelance-crm

[![CI](https://github.com/dgexplores/freelance-crm/actions/workflows/ci.yml/badge.svg)](https://github.com/dgexplores/freelance-crm/actions/workflows/ci.yml)

*Your deals manage themselves.*

---

## TL;DR

A pipeline CRM for **solo freelancers and consultants** that reads your Gmail (read-only), turns inbound threads into a deal board with evidence, and writes your pre-call briefs, proposals, and follow-ups from your rate card. Zero data entry. No guessing.

## 60-second brief

**What:** A pipeline CRM for solo freelancers — read-only Gmail sync turns inbound threads into an evidence-backed deal board, and your rate card powers AI pre-call briefs, proposals, and follow-ups.

**Stack:** Next.js 16 + React 19 + TypeScript, PostgreSQL 17 + Prisma, Better Auth (Google OAuth), Gmail API (read-only), Google Gemini, Tailwind CSS v4, Sentry, Vercel cron.

**Structure:** [`src/app/board/`](src/app/board/) pipeline board and deal detail · [`src/app/api/`](src/app/api/) AI, auth, cron, and health endpoints · [`src/lib/`](src/lib/) Gmail client, pipeline logic, and AI prompts · [`prisma/`](prisma/) schema · [`SETUP.md`](SETUP.md) OAuth setup · [`FREELANCE-CRM-SESSION-LOG.md`](./FREELANCE-CRM-SESSION-LOG.md) delivery record.

**Live demo (verified):** <https://freelance-crm-xi.vercel.app>

---

## Status

**🟢 Deployed to production:** https://freelance-crm-xi.vercel.app

### Done
- **Security hardening** — IDOR closed (session + owner scoping on every AI route, locked by a regression test), rate limiting on AI endpoints, typed error hierarchy, sanitized errors, Gemini key moved to headers
- **Reliability** — retry with backoff on Gmail/Gemini failures, atomic per-message DB staging, forward-sync boundary race fixed, DB hot-path indexes, session-less cron scheduler that actually works
- **Product UX** — drag-and-drop kanban with optimistic moves, streaming AI output (shimmer → typewriter → result card), motion design with `prefers-reduced-motion` support
- **Quality gates** — 31 unit tests + 10 Postgres integration tests run in CI on every push; lint + typecheck + production build all green
- **Ops** — Dockerfile + prod compose stack, `vercel.json` cron, backup + restore scripts, privacy policy + terms pages
- **Infrastructure** — Supabase Postgres provisioned and migrated; Vercel project deployed with auth/cron/DB secrets wired

### Left
| Item | Who |
|------|-----|
| Google OAuth keys (`GOOGLE_CLIENT_ID`/`SECRET`) → Vercel env | Owner |
| Gemini key (`GEMINI_API_KEY`) → Vercel env | Owner |
| Redeploy after keys → full end-to-end loop | Either |
| Stripe billing + AI usage metering | Deferred by owner |
| Persist AI outputs to DB · onboarding checklist · Redis-backed limits · Playwright E2E · HTML email extraction | Backlog |
| `gmail.readonly` restricted-scope strategy before public launch (CASA assessment vs waitlist-first) | Decision needed |

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
- **Claim** — Literal statement from email
- **Source** — `email`, `signature-block`, `linkedin`, `web`
- **Strength** — `strong` (directly stated) or `suggestion` (keyword heuristic)
- **Applied** — Whether written into contact/deal record

*No guessing. Confidently wrong facts are worse than blank fields.*

### 6. Gmail Sync
- **Read-only** (`gmail.readonly` scope) — never sends, moves, archives, deletes
- **Forward-only** — First import reads ≤24h back, then records boundary; older mail never imported
- **Per-user boundary** — Stored on `User.gmailSyncStartedAt`, only advances on successful import
- **Deduplication** — One contact per (user, email); one deal per contact

### 7. Task Scheduling + Cron
- **Manual:** Create follow-up/brief/proposal tasks from deal detail
- **Automatic:** `GET /api/cron/stale-followups` (daily cron) schedules follow-ups for deals idle ≥5 days
- **Each task carries a reason** — You decide if it still matters

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

### Vercel + Neon (Recommended)
1. Create Neon project, copy connection string
2. `DATABASE_URL="<neon>" npm run db:push`
3. Import repo to Vercel
4. Add **all** environment variables (see below)
5. Add production redirect URI to Google OAuth: `https://your-domain.com/api/auth/callback/google`
6. Deploy

### Required Production Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon, Supabase, etc.) |
| `BETTER_AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Yes | Production URL (e.g., `https://your-domain.com`) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `CRON_SECRET` | Yes | `openssl rand -base64 32` (for `/api/cron/stale-followups`) |

### Recommended Production Variables
| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | AI features (briefs, proposals, nudges) |
| `STRIPE_SECRET_KEY` | Billing (when implemented) |
| `SENTRY_DSN` | Error monitoring |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sentry source map upload |
| `SENTRY_ENVIRONMENT` | `production` (auto-set on Vercel) |

### Database Backups
Automated daily backups via cron:
```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * /path/to/scripts/backup-db.sh
```
Required: `BACKUP_DIR`, `RETENTION_DAYS`, `DATABASE_URL`

### Pre-Deployment Checklist
```bash
npm run predeploy
```
Runs: typecheck → lint → tests → build → DB connectivity → migration status

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
npm run test         # Unit tests (31 tests)
npm run test:watch   # Watch mode
npm run db:push      # Push schema to DB
npm run db:generate  # Generate Prisma client
npm run db:studio    # Prisma Studio
npm run predeploy    # Full pre-deployment validation
npm run backup:db    # Database backup (production)
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
│   ├── api/
│   │   ├── ai/           # AI endpoints (brief, proposal, nudge, stale)
│   │   ├── auth/         # Better Auth endpoints
│   │   ├── cron/         # Scheduled jobs (stale follow-ups)
│   │   └── health/       # Health check endpoint
│   ├── board/            # Pipeline board + deal detail
│   ├── settings/         # Rate card & account settings
│   └── sign-in/          # Auth page
├── components/           # Nav, skeletons, error boundaries
├── lib/
│   ├── ai/               # AI prompts & generation (brief, proposal, nudge, context)
│   ├── auth.ts           # Better Auth config
│   ├── gmail.ts          # Gmail API client (read-only, forward-only)
│   ├── pipeline.ts       # Import & staging logic (dedupe, evidence, facts)
│   ├── logger.ts         # Structured JSON logging
│   ├── prisma.ts         # Prisma client singleton
│   └── session.ts        # Server session helpers
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