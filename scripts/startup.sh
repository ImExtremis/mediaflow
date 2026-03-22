#!/usr/bin/env bash
# MediaFlow Startup Script
# Runs on system boot to ensure all services start correctly
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/startup.log"
mkdir -p "$SCRIPT_DIR/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

log "MediaFlow startup sequence initiated"

# Add sudo handling — if docker fails without sudo, retry with sudo
DOCKER_CMD="docker"
if ! docker info >/dev/null 2>&1; then
  if sudo docker info >/dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
  fi
fi

# Wait for Docker to be ready
timeout=60
while ! $DOCKER_CMD info >/dev/null 2>&1; do
  log "Waiting for Docker daemon... ($timeout seconds remaining)"
  sleep 2
  ((timeout -= 2)) || true
  if [[ $timeout -le 0 ]]; then
    log "ERROR: Docker daemon not ready after 60 seconds"
    exit 1
  fi
done
log "Docker daemon ready"

# Remove stale maintenance mode if present
rm -f "$SCRIPT_DIR/state/maintenance" 2>/dev/null || true

# Start the stack
log "Starting MediaFlow stack..."
$DOCKER_CMD compose -f /home/imextremis/mediaflow/docker-compose.yml up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE"

# Wait and verify
sleep 15
log "Verifying container health..."
unhealthy=$($DOCKER_CMD compose -f /home/imextremis/mediaflow/docker-compose.yml ps --format json 2>/dev/null | \
  python3 -c "import sys,json; data=[json.loads(l) for l in sys.stdin if l.strip()]; print('\n'.join(c['Service'] for c in data if c.get('State') in ['exited','restarting','unhealthy']))" 2>/dev/null || true)

if [[ -z "$unhealthy" ]]; then
  log "All containers healthy — MediaFlow started successfully"
else
  log "WARNING: Some containers may need attention: $unhealthy"
  log "Attempting restart of unhealthy containers..."
  $DOCKER_CMD compose -f /home/imextremis/mediaflow/docker-compose.yml up -d --remove-orphans 2>&1 | tee -a "$LOG_FILE" || true
fi

# Second verification pass after 30 seconds
sleep 30
log "Running second verification pass..."
$DOCKER_CMD compose -f /home/imextremis/mediaflow/docker-compose.yml ps --format json 2>/dev/null | \
  python3 -c "import sys,json; [print(c['Service']) for c in [json.loads(l) for l in sys.stdin if l.strip()] if c.get('State') == 'exited']" | \
  while read service; do
    log "Restarting exited service: $service"
    $DOCKER_CMD compose -f /home/imextremis/mediaflow/docker-compose.yml up -d "$service" 2>/dev/null || true
  done

log "Startup sequence complete"
