#!/usr/bin/env bash
# Restore a pg_dump custom archive into a TARGET database.
# NEVER restore V2 dumps into V1 (or vice versa).
# Usage:
#   TARGET_DATABASE_URL=postgresql://... ./deploy/scripts/restore-db.sh path/to/backup.dump
set -euo pipefail

DUMP_FILE="${1:-}"
if [[ -z "${DUMP_FILE}" || ! -f "${DUMP_FILE}" ]]; then
  echo "Usage: TARGET_DATABASE_URL=... $0 <backup.dump>" >&2
  exit 1
fi
if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "TARGET_DATABASE_URL is required" >&2
  exit 1
fi

pgurl="${TARGET_DATABASE_URL/postgresql+asyncpg:/postgresql:}"
pgurl="${pgurl/postgresql+psycopg:/postgresql:}"

echo "Restoring ${DUMP_FILE} → target (this overwrites objects in that DB)"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="${pgurl}" "${DUMP_FILE}"
echo "Restore finished."
