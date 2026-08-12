# freelance-crm

Inbox-first pipeline CRM for freelancers and consultants. AI reads your email, builds your deal board, writes the briefs and nags the follow-ups. No data entry.

## Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript
- Prisma + PostgreSQL (docker compose)
- Better Auth (planned)

## Quick start

```sh
cp .env.example .env   # set DATABASE_URL if not default
docker compose up -d   # Postgres on :5432
npx prisma db push     # apply schema
npx prisma generate
npm run dev            # http://localhost:3000
```

## Data model

- `User` — one person, their rate card (markdown: rates, services, terms)
- `Contact` — a person, deduped by email per user
- `Deal` — pipeline entry with stage + `whyInPipeline` evidence
- `Email` — imported Gmail threads, AI-tagged with sentiment + pipeline action
- `Task` — AI-scheduled follow-ups, briefs, proposals, each with a reason
- `Fact` — evidence ledger: claims carry source + strength (strong/suggestion), never guessed

Pipeline: INBOX → QUALIFIED → PROPOSAL → WON / LOST

## Vs Comp AI CRM (trycompai/crm)

| | Comp AI CRM | freelance-crm |
|---|---|---|
| Persona | B2B sales **teams** | **One freelancer/consultant** |
| Scope | Horizontal: contacts/companies/deals | Vertical: freelancer workflow only |
| AI | **Research** engine: enrich, web, LinkedIn, budgets, rechecks | **Sales execution** loop: mail → pipeline → brief → proposal → nudge |
| UX | Dashboard-centric, Agent tab per record | Inbox-centric: lives in the email thread, zero data entry |
| Evidence | Strong/suggestion ledger from data vendors | Same rule, but source = **your own email and signature blocks** |
| Ops | Vercel AI Gateway, Perplexity, RapidAPI, sandbox | Lean: Gmail OAuth + one LLM. Cheap to run anywhere |
| Email | Mailbox mirror | **Pipeline signal engine**: sentiment, stage moves, follow-up triggers |
| Business | Open source, self-host | Self-serve, Stripe, built for paying solo users |

Same bones, different muscle: keep their no-guess-facts rule, drop the research engine, add a closed inbox→deal loop.

## Phase 1 scope (solo build)

1. Gmail OAuth + mailbox import (forward-only)
2. Deal board auto-populated from email signals, "why in pipeline" shown per deal
3. AI: pre-call brief, follow-up nudge, proposal draft from rate card
4. Stripe billing, closed beta