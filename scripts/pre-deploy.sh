#!/usr/bin/env bash
# Pre-deployment validation. Run before promoting a build to production.
#
#   npm run predeploy
#
# Env: DATABASE_URL is required for the database checks. Set SKIP_DB_CHECKS=1 to
# run only the local (typecheck/lint/test/build) half.

set -euo pipefail

echo "=== Pre-deployment checks ==="

# 1. Required environment variables
required_vars=(
  "DATABASE_URL"
  "BETTER_AUTH_SECRET"
  "BETTER_AUTH_URL"
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
)

echo "Checking required environment variables..."
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: missing required env var: $var" >&2
    exit 1
  fi
  echo "  ok  $var"
done

# Optional but recommended. Note STRIPE_SECRET_KEY is deliberately absent:
# billing is not implemented and no code reads it.
optional_vars=("GEMINI_API_KEY" "CRON_SECRET" "SENTRY_DSN")
for var in "${optional_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "  --  optional: $var not set"
  else
    echo "  ok  $var"
  fi
done

# 2. Prisma client. Without this, typecheck resolves @prisma/client to its
# un-generated stub and passes vacuously.
echo "Generating Prisma client..."
npm run db:generate

# 3. Typecheck
echo "Running TypeScript typecheck..."
npm run typecheck

# 4. Lint
echo "Running ESLint..."
npm run lint

# 5. Unit tests
echo "Running unit tests..."
npm run test

# 6. Production build
echo "Building application..."
npm run build

if [[ "${SKIP_DB_CHECKS:-0}" == "1" ]]; then
  echo "SKIP_DB_CHECKS=1 — skipping database checks."
  echo "=== Local checks passed ==="
  exit 0
fi

# 7. Database connectivity
echo "Verifying database connectivity..."
npx prisma db execute --stdin --schema prisma/schema.prisma <<< "SELECT 1;" > /dev/null
echo "  ok  connected"

# 8. Schema drift. This project has no prisma/migrations directory (the schema
# is applied with `prisma db push`), so `prisma migrate status` cannot be used —
# it exits non-zero with "No migration found in prisma/migrations", which made
# this script impossible to pass. Compare the live database to the schema
# directly instead.
echo "Checking for schema drift..."
set +e
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code > /dev/null 2>&1
drift_status=$?
set -e

if [[ $drift_status -eq 1 ]]; then
  echo "ERROR: the live database does not match prisma/schema.prisma." >&2
  echo "       Run \`npm run db:drift\` to see the difference, then apply it" >&2
  echo "       with \`npm run db:push\` (or move to migrations — see SETUP.md)." >&2
  exit 1
elif [[ $drift_status -ne 0 ]]; then
  echo "  --  could not compare database to schema (prisma migrate diff exited $drift_status)" >&2
  echo "      Continuing, but treat schema state as unverified." >&2
else
  echo "  ok  database matches the schema"
fi

# 9. Row-level security. Prisma creates new tables with RLS disabled, so a
# schema push can silently re-expose data through Supabase's PostgREST API.
echo "Verifying row-level security on public tables..."
rls_missing=$(psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;")
if [[ "${rls_missing:-0}" != "0" ]]; then
  echo "ERROR: $rls_missing public table(s) have RLS disabled." >&2
  echo "       Run \`npm run db:rls\` to re-apply prisma/rls-lockdown.sql." >&2
  exit 1
fi
echo "  ok  RLS enabled on all public tables"

echo "=== All pre-deployment checks passed ==="
