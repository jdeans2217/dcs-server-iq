#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_FILE="$ROOT_DIR/sql/schema.sql"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "ERROR: schema file not found at $SCHEMA_FILE"
  exit 1
fi

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=55432}"
: "${PGDATABASE:=dcs_server_iq}"
: "${PGUSER:=walter}"
: "${PGPASSWORD:=walter_dev}"
: "${PGADMIN_DB:=postgres}"

export PGPASSWORD

echo "Initializing database '$PGDATABASE' on $PGHOST:$PGPORT as user '$PGUSER'"

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGADMIN_DB" -v ON_ERROR_STOP=1 -v target_db="$PGDATABASE" <<'SQL'
SELECT format('CREATE DATABASE %I', :'target_db')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'target_db'
)\gexec
SQL

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$SCHEMA_FILE"

echo "Database initialized successfully."
