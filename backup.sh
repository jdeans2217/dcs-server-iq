#!/bin/bash
# DCS Server Data Backup Script
# Run via cron to fetch and store server data locally (without PostgreSQL)
# Provides redundancy if database is down

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/backup.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
}

log "Starting backup..."

# Activate conda environment if needed
if [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
    source "$HOME/miniconda3/etc/profile.d/conda.sh"
    conda activate dcs 2>/dev/null || true
fi

# Run backup fetch
if python backup_fetch.py 2>> "$LOG_FILE"; then
    log "Backup complete"
else
    log "ERROR: Backup failed"
    exit 1
fi

# Trim log file (keep last 500 lines)
if [ -f "$LOG_FILE" ] && [ $(wc -l < "$LOG_FILE") -gt 500 ]; then
    tail -250 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
