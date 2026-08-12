# Setup guide

Covers local development and a production deployment. Assumes macOS or Linux, Node 22+, and npm.

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
npm install
```

## 2. Local database

```sh
docker compose up -d       # Postgres 17 on :5432
npx prisma db push         # create tables
npx prisma generate        # generate the client
```

Environment: copy `.env.example` to `.env`. The default `DATABASE_URL` already matches the docker compose database, so leave it unless you use your own Postgres.

```sh
cp .env.example .env
```

Verify the tables exist:

```sh
docker compose exec postgres psql -U freelance -c "\dt"
```

Should list: Contact, Deal, Email, Fact, Task, User.

## 3. Run it

```sh
npm run dev
```

- App: http://localhost:3000
- Postgres: localhost:5432, user/password `freelance`/`freelance`, database `freelance`

Stop the database with `docker compose down` (data persists in the `pgdata` volume; add `-v` to wipe it).

## 4. Google OAuth and Gmail access

The product reads your inbox, so it needs a Google Cloud project with the Gmail API and a redirect URI.

1. Go to Google Cloud Console → Credentials → Create credentials → OAuth client ID → Web application.
2. Authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://<your-domain>/api/auth/callback/google`
3. Enable the Gmail API for the project (APIs & Services → Library → Gmail API → Enable).
4. Copy the client ID and secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

OAuth scope is read-only. The CRM can list and read messages and can never send, reply, move, or delete. Import is forward-only: the first check records the current time and imports nothing before it.

## 5. Environment variables

| Variable | Required | What it holds |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | OAuth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | Google OAuth client secret |
| `OPENAI_API_KEY` | AI features | LLM for briefs, drafts, stage analysis |
| `STRIPE_SECRET_KEY` | Billing (later) | Stripe secret key |

Generate the auth secret:

```sh
openssl rand -base64 32
```

## 6. Production deployment (Vercel + Neon)

1. Create a Neon project (or any Postgres) and copy the connection string into `DATABASE_URL`.
2. Push the schema: `DATABASE_URL="<neon string>" npx prisma db push`.
3. Deploy the app to Vercel: import the repo, set the env vars from step 5, deploy.
4. Add the production redirect URI from step 4 to your Google OAuth client.
5. In Vercel, set `NEXTAUTH_URL`/callback domain to your production origin.

Faster path: install the Vercel Postgres or Neon integration, which sets `DATABASE_URL` for you, then rerun `prisma db push` against it.

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `P1001: Can't reach database server` | `docker compose up -d`, wait for healthy, retry `prisma db push` |
| `P1000: Authentication failed` | `.env` still has the placeholder URL; set `freelance:freelance@localhost:5432/freelance` |
| Port 5432 already in use | Change the port mapping in `docker-compose.yml` and the URL in `.env` |
| Google button fails | Client ID and secret must be set together; redirect URI must match exactly |
| Mail never syncs | Check OAuth consent screen, confirm Gmail API enabled, re-auth |
| Prisma CLI errors about `url` in schema | You are on Prisma 7; project pins Prisma 6: `npm install prisma@6 @prisma/client@6` |