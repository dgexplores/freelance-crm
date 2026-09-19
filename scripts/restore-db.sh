#!/usr/bin/env bash
#
# Restore a database backup produced by backup-db.sh.
# Usage:
#   ./scripts/restore-db.sh backups/freelance-crm_20260825_020000.sql.gz   # explicit file
#   ./scripts/restore-db.sh                                        # pick latest in BACKUP_DIR
#
# Env: DATABASE_URL (required), BACKUP_DIR (default /var/backups/freelance-crm)
# Safety: prompts before wiping the target schema.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/freelance-crm}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "ERROR: pg_restore not found. Install PostgreSQL client tools." >&2
  exit 1
fi

file="${1:-}"
if [[ -z "$file" ]]; then
  latest=$(ls -t "$BACKUP_DIR"/freelance-crm_*.sql.gz 2>/dev/null | head -n 1 || true)
  if [[ -z "$latest" ]]; then
    echo "ERROR: no freelance-crm_*.sql.gz backups found in $BACKUP_DIR" >&2
    exit 1
  fi
  file="$latest"
fi

if [[ ! -f "$file" ]]; then
  echo "ERROR: backup file not found: $file" >&2
  exit 1
fi

echo "Target : $DATABASE_URL"
echo "Backup : $file"
echo
read -r -p "This will DROP and recreate the public schema on the target. Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 1
fi

echo "-- Dropping schema..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
SQL

echo "-- Restoring..."
gunzip -c "$file" | pg_restore --no-owner --no-privileges --dbname "$DATABASE_URL"

echo "-- Verifying tables..."
psql "$DATABASE_URL" -c "\dt"

echo "Restore complete. Run \`npm run db:generate\` locally if needed."
