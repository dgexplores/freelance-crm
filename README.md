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

## Phase 1 scope (solo build)

1. Gmail OAuth + mailbox import (forward-only)
2. Deal board auto-populated from email signals, "why in pipeline" shown per deal
3. AI: pre-call brief, follow-up nudge, proposal draft from rate card
4. Stripe billing, closed beta

Built against the grain of Comp AI CRM (trycompai/crm): no orgs, no research budget, no dashboard burying — the CRM lives in the email thread.