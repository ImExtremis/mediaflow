#!/usr/bin/env bash
# MediaFlow Startup Script
# Runs on system boot to ensure all services start correctly
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/startup.log"
mkdir -p "$SCRIPT_DIR/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

log "MediaFlow startup sequence initiated"

# Wait for Docker to be ready
timeout=30
while ! docker info >/dev/null 2>&1; do
  log "Waiting for Docker daemon... ($timeout seconds remaining)"
  sleep 2
  ((timeout -= 2)) || true
  if [[ $timeout -le 0 ]]; then
    log "ERROR: Docker daemon not ready after 30 seconds"
    exit 1
  fi
done
log "Docker daemon ready"

# Remove stale maintenance mode if present
rm -f "$SCRIPT_DIR/state/maintenance" 2>/dev/null || true

# Pull to latest (optional, comment out if you don't want auto-update on boot)
# cd "$SCRIPT_DIR" && git pull origin main --quiet 2>/dev/null || true

# Start the stack
log "Starting MediaFlow stack..."
cd "$SCRIPT_DIR"
docker compose up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE"

# Wait and verify
sleep 15
log "Verifying container health..."
unhealthy=$(docker compose ps --format json 2>/dev/null | \
  python3 -c "import sys,json; data=[json.loads(l) for l in sys.stdin if l.strip()]; print('\n'.join(c['Name'] for c in data if c.get('State') not in ['running','restarting']))" 2>/dev/null || true)

if [[ -z "$unhealthy" ]]; then
  log "All containers healthy — MediaFlow started successfully"
else
  log "WARNING: Some containers may need attention: $unhealthy"
  log "Attempting restart of unhealthy containers..."
  docker compose up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE" || true
fi

log "Startup sequence complete"
