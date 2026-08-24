# freelance-crm

*Your deals manage themselves.*

---

## TL;DR

A pipeline CRM for **solo freelancers and consultants** that reads your Gmail (read-only), turns inbound threads into a deal board with evidence, and writes your pre-call briefs, proposals, and follow-ups from your rate card. Zero data entry. No guessing.

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
npm run test         # Unit tests (24 tests)
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
- [ ] Stripe billing, subscription management
- [ ] Email thread view with inline actions
- [ ] Contact enrichment from signature blocks
- [ ] Mobile-responsive improvements
- [ ] Webhook support for real-time Gmail push

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