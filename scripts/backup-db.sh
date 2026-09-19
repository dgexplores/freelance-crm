#!/bin/bash
# Production database backup script
# Run via cron: 0 2 * * * /path/to/backup-db.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/freelance-crm}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATABASE_URL="${DATABASE_URL}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/freelance-crm_$TIMESTAMP.sql.gz"

echo "[$(date)] Starting backup to $BACKUP_FILE"

# pg_dump reads DATABASE_URL natively (handles special chars, missing
# port, and query strings like ?sslmode=require on Neon/Supabase).
pg_dump "$DATABASE_URL" --no-owner --no-privileges --format=custom | gzip > "$BACKUP_FILE"

if [[ $? -eq 0 ]]; then
  echo "[$(date)] Backup completed: $BACKUP_FILE"
  
  # Verify backup
  if gunzip -t "$BACKUP_FILE"; then
    echo "[$(date)] Backup verification passed"
  else
    echo "[$(date)] ERROR: Backup verification failed" >&2
    exit 1
  fi
  
  # Cleanup old backups
  find "$BACKUP_DIR" -name "freelance-crm_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
  echo "[$(date)] Cleaned up backups older than $RETENTION_DAYS days"
else
  echo "[$(date)] ERROR: Backup failed" >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi