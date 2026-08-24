#!/bin/bash
# Pre-deployment validation script
# Runs in CI/CD before production deploy

set -euo pipefail

echo "=== Pre-deployment Checks ==="

# 1. Verify environment variables
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
    echo "ERROR: Missing required env var: $var" >&2
    exit 1
  fi
  echo "  ✓ $var"
done

# Optional but recommended
optional_vars=("GEMINI_API_KEY" "CRON_SECRET" "STRIPE_SECRET_KEY")
for var in "${optional_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "  ⚠ Optional: $var not set"
  else
    echo "  ✓ $var"
  fi
done

# 2. Run typecheck
echo "Running TypeScript typecheck..."
npm run typecheck

# 3. Run lint
echo "Running ESLint..."
npm run lint

# 4. Run tests
echo "Running tests..."
npm run test

# 5. Build
echo "Building application..."
npm run build

# 6. Verify database connectivity
echo "Verifying database connectivity..."
npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null

# 7. Check for pending migrations
echo "Checking migration status..."
npx prisma migrate status

echo "=== All pre-deployment checks passed ==="