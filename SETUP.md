# Setup guide

Covers local development and a production deployment. Assumes macOS or Linux, Node 22+, and npm.

> **Read this if you are picking the project up cold.** Two things are easy to get wrong:
> the schema is applied with `prisma db push` (there is **no** `prisma/migrations`
> directory), and row-level security has to be re-applied after every schema change.
> Both are covered in §7.

## 1. Prerequisites

```sh
node -v        # 22 or newer
npm -v         # 10 or newer
docker --version
```

Clone and install:

```sh
git clone git@github.com:dgexplores/freelance-crm.git
cd freelance-crm
npm ci
```

## 2. Local database

```sh
docker compose up -d       # Postgres 17 on :5432 (service name: postgres)
cp .env.example .env
npx prisma generate        # generate the client
npx prisma db push         # create the tables
```

The default `DATABASE_URL` in `.env.example` already matches the compose database,
so leave it alone unless you are pointing at your own Postgres.

Verify the tables exist:

```sh
docker compose exec postgres psql -U freelance -c "\dt"
```

Should list: `User`, `Session`, `Account`, `Verification`, `Contact`, `Deal`, `Email`,
`Task`, `Fact`.

Stop the database with `docker compose down` (data persists in the `pgdata` volume;
add `-v` to wipe it).

## 3. Run it

```sh
npm run dev
```

- App: http://localhost:3000
- Postgres: localhost:5432, `freelance`/`freelance`, database `freelance`

## 4. Google OAuth and Gmail access

The product reads your inbox, so it needs a Google Cloud project with the Gmail API
and a matching redirect URI.

1. Google Cloud Console → Credentials → Create credentials → OAuth client ID → Web application.
2. Authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://<your-domain>/api/auth/callback/google`
3. Enable the Gmail API (APIs & Services → Library → Gmail API → Enable).
4. Put the client ID and secret in `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

**Scope is `gmail.readonly` and the client is read-only by construction.** Only
`messages.list` and `messages.get` are ever called — no send, reply, move, archive, or
delete request exists anywhere in the codebase.

**Import is forward-only.** The first run backfills at most the **last 24 hours** and
then records a per-user boundary (`User.gmailSyncStartedAt`). Later runs fetch only
mail newer than that boundary. The boundary only moves after a successful run, and
never past a message that was not actually fetched.

> If a single run hits the fetch ceiling (2,500 messages), the boundary advances only
> to the *oldest* message fetched and the UI reports that older mail in that window was
> skipped. That is the one case where mail can be missed, and it is surfaced rather
> than silent. See "Known limitations" in `README.md`.

## 5. Environment variables

| Variable | Required | What it holds |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Supabase, Neon, local Docker…) |
| `BETTER_AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Yes | Origin of the app, e.g. `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `CRON_SECRET` | Prod | `openssl rand -base64 32`; guards `GET /api/cron/stale-followups` |
| `GEMINI_API_KEY` | For AI | Google AI Studio key. Without it the AI routes return 503 gracefully. |
| `SENTRY_DSN` | No | Error monitoring |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | No | Source-map upload |
| `SENTRY_ENVIRONMENT` | No | e.g. `production` |
| `BACKUP_DIR` | No | Where `scripts/backup-db.sh` writes (default `./backups`) |
| `RETENTION_DAYS` | No | Backup retention (default `30`) |

> `STRIPE_SECRET_KEY` is deliberately **not** listed: billing is not implemented and no
> code reads it. Setting it has no effect.

Generate the secrets:

```sh
openssl rand -base64 32   # BETTER_AUTH_SECRET
openssl rand -base64 32   # CRON_SECRET
```

## 6. Production deployment (Vercel + Supabase)

Production runs on Vercel with a Supabase Postgres (Singapore region).

1. Create the Supabase project and copy the connection string into `DATABASE_URL`. Use
   the **pooler** URL for serverless; it carries query parameters and may omit the
   port, which is fine — nothing parses the URL.
2. Push the schema: `DATABASE_URL="<url>" npx prisma db push`.
3. **Enable RLS:** `DATABASE_URL="<url>" npm run db:rls`. Supabase's security advisor
   will otherwise flag every table as publicly accessible.
4. Import the repo into Vercel and set every variable from §5.
5. Add the production redirect URI to the Google OAuth client (§4).
6. Deploy. `vercel.json` registers the daily stale-follow-up cron at 09:00 UTC.
7. Run the pre-deploy checklist before promoting: `npm run predeploy`.

## 7. Schema changes, RLS, and migrations

There is **no `prisma/migrations` directory** — the schema is applied with
`prisma db push`. Two consequences worth knowing:

**(a) RLS is not automatic.** `prisma db push` creates new tables with row-level
security *disabled*, and Supabase exposes every such table through its auto-generated
REST API. After any schema change that adds a table, re-run:

```sh
npm run db:rls        # applies prisma/rls-lockdown.sql
```

`prisma/rls-lockdown.sql` enables RLS with **no policies**, which is deliberate: the app
talks to Postgres directly through Prisma and never through PostgREST, so it needs no
policies to keep working, while the anon/authenticated REST roles are shut out
entirely. It deliberately does *not* use `FORCE ROW LEVEL SECURITY`, because Prisma
connects as the table owner and forcing it would lock the app out of its own data.

`npm run predeploy` checks this for you (step 9) and fails if any public table has RLS
disabled.

**(b) There is no schema history.** `prisma db push` cannot roll back and cannot detect
drift. To check whether the live database still matches `prisma/schema.prisma`:

```sh
npm run db:drift      # prints the SQL needed to reconcile, if any
```

**Adopting migrations** (recommended before this gets more users): generate a baseline
from the current schema, then mark it as already applied on the existing databases.

```sh
npm run db:baseline                                  # writes prisma/migrations/<ts>_baseline/migration.sql
DATABASE_URL="<url>" npx prisma migrate resolve --applied <baseline-dir-name>
```

After that, use `prisma migrate dev` locally and `prisma migrate deploy` in CI.

## 8. Backups

```sh
npm run backup:db     # writes $BACKUP_DIR/freelance-crm_<timestamp>.dump.gz
npm run restore:db    # restores the newest backup in $BACKUP_DIR (prompts first)
```

Both default to `BACKUP_DIR=./backups`. For cron, pass an absolute path:

```cron
0 2 * * * cd /srv/freelance-crm && BACKUP_DIR=/var/backups/freelance-crm ./scripts/backup-db.sh
```

The backup file is a `pg_restore` custom-format archive — hence `.dump.gz`, not
`.sql.gz`. `backup-db.sh` verifies the archive with `pg_restore --list` before
reporting success, so a structurally valid but empty gzip is not mistaken for a good
backup.

> **Restoring drops the `public` schema**, which also drops every RLS setting.
> `restore-db.sh` re-applies `prisma/rls-lockdown.sql` automatically and then prints a
> per-table RLS report — check it.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `P1001: Can't reach database server` | `docker compose up -d`, wait for healthy, retry `prisma db push` |
| `P1000: Authentication failed` | `.env` still has the placeholder URL; use `freelance:freelance@localhost:5432/freelance` |
| Port 5432 already in use | Change the port mapping in `docker-compose.yml` and the URL in `.env` |
| Google button fails | Client ID and secret must be set together; the redirect URI must match exactly |
| Mail never syncs | Check the OAuth consent screen, confirm the Gmail API is enabled, re-auth |
| AI buttons greyed out | Add a rate card in Settings — briefs, proposals and nudges all require one |
| `predeploy` fails on RLS | `npm run db:rls` |
| `predeploy` fails on drift | `npm run db:drift` to see the difference, then `npm run db:push` |
| Prisma CLI complains about `url` in schema | You are on Prisma 7; this project pins Prisma 6 — `npm i prisma@6 @prisma/client@6` |
