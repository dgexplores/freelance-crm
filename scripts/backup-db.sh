#!/usr/bin/env bash
#
# Production database backup.
#
# Run via cron (absolute paths, since cron has no useful cwd):
#   0 2 * * * BACKUP_DIR=/var/backups/freelance-crm /path/to/scripts/backup-db.sh
#
# Env:
#   DATABASE_URL    required — connection URI, passed straight to pg_dump
#   BACKUP_DIR      default ./backups (must match restore-db.sh)
#   RETENTION_DAYS  default 30
#
# Writes $BACKUP_DIR/freelance-crm_<timestamp>.dump.gz.
#
# The ".dump.gz" extension is load-bearing: restore-db.sh globs for exactly
# that, and the file is a pg_restore archive (custom format), not plain SQL —
# naming it ".sql.gz" (as this script used to) both broke the round-trip and
# misled anyone who tried to read it with psql.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install the PostgreSQL client tools." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/freelance-crm_$TIMESTAMP.dump.gz"

# `set -e` exits on a failed pg_dump before any cleanup can run, so remove the
# partial file from a trap instead.
cleanup_on_failure() {
  local status=$?
  if [[ $status -ne 0 && -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]]; then
    echo "[$(date)] Backup failed (exit $status); removing partial file $BACKUP_FILE" >&2
    rm -f "$BACKUP_FILE"
  fi
}
trap cleanup_on_failure EXIT

echo "[$(date)] Starting backup to $BACKUP_FILE"

# Pass the connection URI through untouched — pg_dump accepts it directly.
# The previous implementation regex-parsed the URL into PG* variables, which
# silently broke on the Supabase pooler URLs this project actually uses:
# they carry query parameters and can omit the port, so the database name came
# out as "postgres?pgbouncer=true".
pg_dump --no-owner --no-privileges --format=custom "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# A failed pg_dump can still leave a structurally valid gzip behind, so check
# the archive itself rather than just the compression wrapper.
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "[$(date)] ERROR: backup is not a valid gzip archive" >&2
  exit 1
fi

if ! gzip -dc "$BACKUP_FILE" | pg_restore --list >/dev/null 2>&1; then
  echo "[$(date)] ERROR: archive is not readable by pg_restore — backup is unusable" >&2
  exit 1
fi

echo "[$(date)] Backup completed and verified: $BACKUP_FILE"

find "$BACKUP_DIR" -name "freelance-crm_*.dump.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Removed backups older than $RETENTION_DAYS days"
