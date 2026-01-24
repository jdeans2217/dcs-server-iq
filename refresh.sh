#!/bin/bash
# DCS Server Data Refresh Script
# Run hourly via cron to fetch and ingest server data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/refresh.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() {
    echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
}

log "Starting refresh..."

# Activate conda environment if needed
if [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
    source "$HOME/miniconda3/etc/profile.d/conda.sh"
    conda activate dcs 2>/dev/null || true
fi

# Fetch fresh server data
log "Fetching server data..."
if python fetch_servers.py --out servers.json 2>> "$LOG_FILE"; then
    log "Fetch complete"
else
    log "ERROR: Fetch failed"
    exit 1
fi

# Ingest into database with snapshots
log "Ingesting into database..."
if python ingest_servers.py --input servers.json --snapshot --stats 2>> "$LOG_FILE"; then
    log "Ingest complete"
else
    log "ERROR: Ingest failed"
    exit 1
fi

log "Refresh complete"

# Trim log file (keep last 1000 lines)
if [ -f "$LOG_FILE" ] && [ $(wc -l < "$LOG_FILE") -gt 1000 ]; then
    tail -500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
