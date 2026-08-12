# freelance-crm

*Your deals manage themselves.*

## What it is

Freelance CRM is a pipeline CRM built for one person: a freelancer or consultant running their own practice. It connects to your Gmail, reads your conversations, and turns them into a deal board you never have to type into. Leads appear in your pipeline with the reason why. Before a call, you get a brief. After a call, the follow-up reminder writes itself. You do the work in your inbox; the CRM does everything around it.

## Why it exists

CRMs were built for sales teams and push that machinery onto solo operators: fields to fill, tables to keep, dashboards to interpret. Freelancers do not have a "pipeline" problem, they have a *too busy selling to log anything* problem. So the record keeping here is a side effect of doing business, not a chore in front of it.

The other design rule comes from the failures of AI CRMs: nothing about a person is guessed. Every fact recorded carries its source (your email, a signature block) and a strength (strong or suggestion). A confidently wrong fact about a prospect is worse than a blank field, because nobody can tell it wrong. Strong evidence writes to the record, weak evidence becomes a suggestion you settle in seconds.

## What it does

| | |
|---|---|
| Auto pipeline from inbox | Every inbound thread is read and either placed in a stage or left alone, always with the email that put it there |
| Zero data entry | Contacts, deals, and context come from your own mail, not from forms |
| Pre-call briefs | One glance before every call: who they are, what they last said, where the deal stands |
| Proposal drafts | Pick an open deal, get a draft written from your rate card (services, rates, terms) |
| Follow-up nudges | Each reminder carries the reason it exists, so you decide whether it still matters |
| Evidence ledger | Every claim on a record is sourced and graded, strong or suggestion, never guessed |
| The deal board | Pipeline: INBOX → QUALIFIED → PROPOSAL → WON / LOST, with the story visible on each card |

## Effectiveness

What this buys the one person running a practice:

- **No data entry**: the pipeline is a byproduct of email, so it stays current without discipline. Three weeks of silence on a deal shows up because the system noticed, not because you remembered.
- **Faster proposals**: brief and draft are generated from what you already wrote, so a proposal goes out the same day the call happens.
- **Nothing falls through**: follow-ups are scheduled with reasons and evidence, and the system tells you why every reminder exists.
- **Trustworthy records**: sourced and graded facts, so you never act on a hallucinated detail.

## How to use

1. Sign in with your Google account.
2. Grant read-only mail access (the CRM can read, never send, reply, move, or delete).
3. Your inbox is scanned forward-only: nothing old is imported, ever.
4. Open the deal board. Read the *why* behind each deal, run a brief before your next call, and let the follow-ups happen.

Full setup (local and production) in [SETUP.md](./SETUP.md).

## What it uses

| | |
|---|---|
| Next.js 16 | App Router, Turbopack (React 19) |
| TypeScript | Everywhere |
| Prisma + PostgreSQL | Schema and storage, Postgres 17 via docker compose |
| Gmail API | Read-only mailbox import, forward-only |
| Better Auth | Google sign-in (planned) |
| One LLM | Briefs, drafts, stage analysis, follow-up reasoning |
| Stripe | Self-serve billing (planned) |

## Data model

- `User` — one person, their rate card (markdown: rates, services, terms)
- `Contact` — a person, deduped by email per user
- `Deal` — pipeline entry with stage + `whyInPipeline` evidence
- `Email` — imported Gmail threads, AI-tagged with sentiment + pipeline action
- `Task` — AI-scheduled follow-ups, briefs, proposals, each with a reason
- `Fact` — evidence ledger: claims carry source + strength (strong/suggestion), never guessed

## Roadmap

1. Gmail OAuth + mailbox import (forward-only)
2. Deal board auto-populated from email signals, "why in pipeline" shown per deal
3. AI: pre-call brief, follow-up nudge, proposal draft from rate card
4. Stripe billing, closed beta

## Where it stands vs Comp AI CRM

Built deliberately against the grain of Comp AI CRM (trycompai/crm).

| | Comp AI CRM | freelance-crm |
|---|---|---|
| Persona | B2B sales **teams** | **One freelancer/consultant** |
| Scope | Horizontal: contacts/companies/deals | Vertical: freelancer workflow only |
| AI | Research engine: enrich, web, LinkedIn, budgets, rechecks | Sales execution loop: mail → pipeline → brief → proposal → nudge |
| UX | Dashboard-centric, Agent tab per record | Inbox-centric: lives in the email thread, zero data entry |
| Evidence | Strong/suggestion ledger from data vendors | Same rule, but source = your own email and signature blocks |
| Ops | Vercel AI Gateway, Perplexity, RapidAPI, sandbox | Lean: Gmail OAuth + one LLM. Cheap to run anywhere |
| Business | Open source, self-host | Self-serve, Stripe, built for paying solo users |

Same bones, different muscle: the no-guess-facts rule stays, the research engine goes, and the closed inbox → deal loop is the product.