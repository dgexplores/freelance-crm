# freelance-crm

*Your deals manage themselves.*

## What it is

Freelance CRM is a pipeline CRM built for one person: a freelancer or consultant running their own practice. It connects to your Gmail, reads your conversations, and turns them into a deal board you never have to type into. Leads appear in your pipeline with the reason why. Before a call, you get a brief. After a call, the follow-up reminder writes itself. You do the work in your inbox; the CRM does everything around it.

## Why it exists

CRMs were built for sales teams and push that machinery onto solo operators: fields to fill, tables to keep, dashboards to interpret. Freelancers do not have a "pipeline" problem, they have a *too busy selling to log anything* problem. So the record keeping here is a side effect of doing business, not a chore in front of it.

The other design rule comes from the failures of AI CRMs: nothing about a person is guessed. Every fact recorded carries its source (your email, a signature block) and a strength (strong or suggestion). A confidently wrong fact about a prospect is worse than a blank field, because nobody can tell it wrong. Strong evidence writes to the record, weak evidence becomes a suggestion you settle in seconds.

## What it does

| Feature | Description |
|---|---|
| Auto pipeline from inbox | Every inbound thread is read and either placed in a stage or left alone, always with the email that put it there |
| Zero data entry | Contacts, deals, and context come from your own mail, not from forms |
| Pre-call briefs | One glance before every call: who they are, what they last said, where the deal stands |
| Proposal drafts | Pick an open deal, get a draft written from your rate card (services, rates, terms) |
| Follow-up nudges | Each reminder carries the reason it exists, so you decide whether it still matters |
| Evidence ledger | Every claim on a record is sourced and graded, strong or suggestion, never guessed |
| The deal board | Pipeline: INBOX → QUALIFIED → PROPOSAL → WON / LOST, with the story visible on each card |
| Rate card management | Markdown-based rate card powers all AI features |
| Task scheduling | Auto-schedule follow-ups for stale deals |
| Gmail sync | Forward-only, read-only import with boundary tracking |

## Effectiveness

What this buys the one person running a practice:

- **No data entry**: the pipeline is a byproduct of email, so it stays current without discipline. Three weeks of silence on a deal shows up because the system noticed, not because you remembered.
- **Faster proposals**: brief and draft are generated from what you already wrote, so a proposal goes out the same day the call happens.
- **Nothing falls through**: follow-ups are scheduled with reasons and evidence, and the system tells you why every reminder exists.
- **Trustworthy records**: sourced and graded facts, so you never act on a hallucinated detail.

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
# Edit .env with your credentials

# Initialize database
npm run db:generate
npm run db:push

# Run development server
npm run dev
```

App runs at `http://localhost:3000`

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Yes | App URL (e.g., `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | OAuth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | Google OAuth client secret |
| `GEMINI_API_KEY` | AI features | Google AI Studio API key |
| `CRON_SECRET` | Scheduled jobs | `openssl rand -base64 32` |

See [SETUP.md](./SETUP.md) for detailed setup including Google OAuth configuration.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 17 + Prisma ORM |
| Auth | Better Auth (Google OAuth) |
| Email | Gmail API (read-only, `gmail.readonly` scope) |
| AI | Google Gemini (briefs, proposals, nudges) |
| Styling | Tailwind CSS v4 |
| Testing | Vitest + React Testing Library |
| CI/CD | GitHub Actions → Vercel |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ai/           # AI endpoints (brief, proposal, nudge)
│   │   ├── auth/         # Better Auth endpoints
│   │   └── cron/         # Scheduled jobs
│   ├── board/            # Pipeline board + deal detail
│   ├── settings/         # Rate card & account settings
│   └── sign-in/          # Auth page
├── components/           # Shared UI components
├── lib/
│   ├── ai/               # AI prompts & generation
│   ├── auth.ts           # Better Auth config
│   ├── gmail.ts          # Gmail API client
│   ├── pipeline.ts       # Import & staging logic
│   ├── logger.ts         # Structured logging
│   └── prisma.ts         # Prisma client singleton
└── middleware.ts         # Auth protection
```

## Data Model

- **User** — one person, their rate card (markdown: rates, services, terms)
- **Contact** — a person, deduped by email per user
- **Deal** — pipeline entry with stage + `whyInPipeline` evidence
- **Email** — imported Gmail threads, AI-tagged with sentiment + pipeline action
- **Task** — AI-scheduled follow-ups, briefs, proposals, each with a reason
- **Fact** — evidence ledger: claims carry source + strength (strong/suggestion), never guessed

## Pipeline Stages

```
INBOX → QUALIFIED → PROPOSAL → WON / LOST
```

- **INBOX**: New inbound contact, auto-created from email
- **QUALIFIED**: Real opportunity, worth pursuing
- **PROPOSAL**: Proposal sent, awaiting response
- **WON**: Closed won
- **LOST**: Closed lost (with reason)

## AI Features

### Pre-Call Brief
Generates a concise brief from the deal context, contact history, and your rate card. Sections: Who they are, What they last said, Where the deal stands, What to confirm, Suggested talking points.

### Proposal Draft
Writes a professional proposal from your rate card and the email thread. Only uses services/rates/terms that exist on your rate card — never invents prices.

### Follow-Up Nudge
Drafts a short, human re-engagement email for deals that have gone stale (5+ days in INBOX/QUALIFIED). References specific thread context, asks a single low-friction question.

### Evidence Ledger
Every fact extracted from emails is stored with:
- **Claim**: The literal statement
- **Source**: `email`, `signature-block`, `linkedin`, `web`
- **Strength**: `strong` (directly stated) or `suggestion` (keyword heuristic)
- **Applied**: Whether it's written into the contact/deal record

## Scheduled Jobs

`GET /api/cron/stale-followups` — Runs daily to schedule follow-up tasks for deals idle ≥5 days in INBOX/QUALIFIED. Requires `CRON_SECRET` in Authorization header.

Deploy with Vercel Cron or any scheduler (cron, GitHub Actions, etc.).

## Production Deployment

### Vercel + Neon (Recommended)

1. Create Neon project, copy connection string
2. `DATABASE_URL="<neon>" npm run db:push`
3. Import repo to Vercel
4. Add all environment variables
5. Add production redirect URI to Google OAuth
6. Deploy

### Docker

```dockerfile
# Build
docker build -t freelance-crm .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL=... \
  -e BETTER_AUTH_SECRET=... \
  -e GOOGLE_CLIENT_ID=... \
  -e GOOGLE_CLIENT_SECRET=... \
  -e GEMINI_API_KEY=... \
  freelance-crm
```

## Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run test         # Unit tests
npm run test:watch   # Watch mode
npm run db:push      # Push schema to DB
npm run db:generate  # Generate Prisma client
npm run db:studio    # Prisma Studio
```

## Roadmap

1. ✅ Gmail OAuth + mailbox import (forward-only)
2. ✅ Deal board auto-populated from email signals
3. ✅ AI: pre-call brief, follow-up nudge, proposal draft
4. ✅ Rate card management, task scheduling
5. 🔄 Stripe billing, subscription management
6. 🔄 Email thread view with inline actions
7. 🔄 Contact enrichment from signature blocks
8. 🔄 Mobile-responsive improvements

## Where it stands vs Comp AI CRM

Built deliberately against the grain of Comp AI CRM (trycompai/crm).

| | Comp AI CRM | freelance-crm |
|---|---|---|
| Persona | B2B sales **teams** | **One freelancer/consultant** |
| Scope | Horizontal: contacts/companies/deals | Vertical: freelancer workflow only |
| AI | Research engine: enrich, web, LinkedIn, budgets | Sales execution loop: mail → pipeline → brief → proposal → nudge |
| UX | Dashboard-centric, Agent tab per record | Inbox-centric: lives in the email thread, zero data entry |
| Evidence | Strong/suggestion ledger from data vendors | Same rule, but source = your own email and signature blocks |
| Ops | Vercel AI Gateway, Perplexity, RapidAPI, sandbox | Lean: Gmail OAuth + one LLM. Cheap to run anywhere |
| Business | Open source, self-host | Self-serve, Stripe, built for paying solo users |

Same bones, different muscle: the no-guess-facts rule stays, the research engine goes, and the closed inbox → deal loop is the product.

## License

MIT