#!/usr/bin/env bash
# Backup Cognitif Postgres databases (Neon test or RDS staging).
# Usage:
#   FRONTEND_DATABASE_URL=... BACKEND_DATABASE_URL=... ./deploy/scripts/backup-db.sh
# Requires: pg_dump (postgresql-client)
set -euo pipefail

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "${OUT_DIR}"

backup_one() {
  local label="$1"
  local url="$2"
  if [[ -z "${url}" ]]; then
    echo "skip ${label}: URL empty" >&2
    return 0
  fi
  # Strip SQLAlchemy driver prefixes for pg_dump
  local pgurl="${url/postgresql+asyncpg:/postgresql:}"
  pgurl="${pgurl/postgresql+psycopg:/postgresql:}"
  local file="${OUT_DIR}/${label}_${STAMP}.dump"
  echo "Backing up ${label} → ${file}"
  pg_dump --format=custom --no-owner --no-acl "${pgurl}" --file="${file}"
  echo "OK ${file}"
}

backup_one "frontend_v1" "${FRONTEND_DATABASE_URL:-}"
backup_one "backend_v2" "${BACKEND_DATABASE_URL:-}"
echo "Done. Store backups offline; do not commit them to git."
