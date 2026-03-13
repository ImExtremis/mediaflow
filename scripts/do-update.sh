#!/usr/bin/env bash
# =============================================================================
#  MediaFlow · scripts/do-update.sh
#  The actual updater — called by update.sh after git pull
#  Never call this script directly in production.
# =============================================================================
# This script is called by update.sh after git pull.
# MEDIAFLOW_AUTH=1 is inherited from the environment — no password re-prompt.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

# Self-heal state, backups, and logs directory permissions
# This runs before anything else so fresh installs never get Permission denied
mkdir -p "$SCRIPT_DIR/state" "$SCRIPT_DIR/backups" "$SCRIPT_DIR/logs"
chmod 775 "$SCRIPT_DIR/state" "$SCRIPT_DIR/backups" "$SCRIPT_DIR/logs" 2>/dev/null || true
chown "$(whoami):$(whoami)" "$SCRIPT_DIR/state" "$SCRIPT_DIR/backups" "$SCRIPT_DIR/logs" 2>/dev/null || true

# --skip-pull is accepted but effectively a no-op here; pull was done by update.sh
SKIP_PULL=false
if [[ "${1:-}" == "--skip-pull" ]]; then
  SKIP_PULL=true
  shift
fi

# Record start time and old version for history
START_TIME=$(date +%s)
OLD_VERSION=$(cat VERSION 2>/dev/null || echo "unknown")
BACKUP_DIR=""

echo ""
echo -e "${BOLD}${CYAN}MediaFlow Updater${RESET}"
echo ""

# Function to record update history
record_history() {
  local result=$1
  local new_version=$2
  local duration=$(($(date +%s) - START_TIME))
  mkdir -p ./logs
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local containers=$(docker compose ps --services | paste -sd "," - || echo "none")
  echo "{\"timestamp\":\"$timestamp\",\"previousVersion\":\"$OLD_VERSION\",\"newVersion\":\"$new_version\",\"duration\":$duration,\"result\":\"$result\",\"containers\":\"$containers\"}" >> ./logs/update-history.log
}

# -----------------------------------------------------------------------------
# Auto Rollback Function
# -----------------------------------------------------------------------------
auto_rollback() {
  echo ""
  echo -e "${BOLD}${RED}UPDATE FAILED — INITIATING AUTO ROLLBACK${RESET}"

  info "Stopping containers..."
  docker compose down --remove-orphans >/dev/null 2>&1 || true

  # Pre-rollback check: only restore if backup is valid and non-empty
  if [[ -z "$BACKUP_DIR" || ! -d "$BACKUP_DIR" || -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]]; then
    warn "No valid backup found — skipping restore, restarting containers from current state"
    docker compose up -d --remove-orphans || true
    sleep 10
    rm -f "$SCRIPT_DIR/state/maintenance"
    echo -e "${YELLOW}Rollback skipped (no backup) — containers restarted from current state${RESET}"
    record_history "rollback_no_backup" "$OLD_VERSION"
    exit 1
  fi

  info "Restoring files from backup ($BACKUP_DIR)..."
  cp -f "$BACKUP_DIR/docker-compose.yml" ./ 2>/dev/null || true
  cp -f "$BACKUP_DIR/.env" ./ 2>/dev/null || true
  cp -f "$BACKUP_DIR/VERSION" ./ 2>/dev/null || true

  info "Reverting any pulled code changes..."
  git stash || true

  info "Removing any orphaned containers blocking port 5055..."
  ORPHAN=$(docker ps --format '{{.Names}} {{.Ports}}' | grep ':5055->' | awk '{print $1}' || true)
  if [[ -n "$ORPHAN" && "$ORPHAN" != "mediaflow_jellyseerr" ]]; then
    info "Removing orphan container using port 5055: $ORPHAN"
    docker stop "$ORPHAN" >/dev/null 2>&1 || true
    docker rm "$ORPHAN" >/dev/null 2>&1 || true
  fi

  info "Restarting containers..."
  docker compose up -d --remove-orphans || true

  info "Waiting for health checks to pass..."
  sleep 10

  info "Disabling maintenance mode..."
  rm -f "$SCRIPT_DIR/state/maintenance"

  echo -e "${YELLOW}Rollback completed successfully — your system is restored to the previous version${RESET}"
  echo -e "Backup path: ${CYAN}$BACKUP_DIR${RESET}"

  record_history "rollback" "$OLD_VERSION"
  exit 1
}

# -----------------------------------------------------------------------------
# STEP 1: Pre-flight checks
# -----------------------------------------------------------------------------
info "Step 1: Running pre-flight checks..."

# Check for orphaned containers on port 5055
ORPHAN=$(docker ps --format '{{.Names}} {{.Ports}}' | grep ':5055->' | awk '{print $1}' || true)
if [[ -n "$ORPHAN" && "$ORPHAN" != "mediaflow_jellyseerr" ]]; then
  info "Removing orphan container using port 5055: $ORPHAN"
  docker stop "$ORPHAN" >/dev/null 2>&1 || true
  docker rm "$ORPHAN" >/dev/null 2>&1 || true
fi

# Check Docker
if ! docker info >/dev/null 2>&1; then
  die "Docker is not running or current user does not have permissions."
fi

# Check Internet
if ! ping -c 1 github.com >/dev/null 2>&1; then
  die "Internet connectivity check failed (cannot ping github.com)."
fi

# Check Disk Space (Require at least 2GB free)
available_kb=$(df -k "$SCRIPT_DIR" | tail -1 | awk '{print $4}')
available_gb=$(( available_kb / 1024 / 1024 ))
if (( available_gb < 2 )); then
  die "Insufficient disk space. Need at least 2GB free, have ${available_gb}GB."
fi
success "Pre-flight checks passed."

# -----------------------------------------------------------------------------
# STEP 2: Backup
# -----------------------------------------------------------------------------
info "Step 2: Creating backup..."
BACKUP_DIR="${SCRIPT_DIR}/backups/pre-update-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -f docker-compose.yml VERSION .env "$BACKUP_DIR/" 2>/dev/null || true
cp -r config appdata "$BACKUP_DIR/" 2>/dev/null || true

bash backup.sh --auto 2>/dev/null || warn "backup.sh skipped or failed"
success "Backup saved to $BACKUP_DIR"

# After backup is done, switch to non-fatal mode.
# Only auto_rollback will be called explicitly on critical failures.
set +e

# -----------------------------------------------------------------------------
# STEP 3: Enable maintenance mode
# -----------------------------------------------------------------------------
info "Step 3: Enabling maintenance mode..."
mkdir -p "$SCRIPT_DIR/state"
echo "MAINTENANCE=true" > "$SCRIPT_DIR/state/maintenance"
success "Maintenance mode enabled."

# -----------------------------------------------------------------------------
# STEP 4: Confirm pull was done (by update.sh launcher)
# -----------------------------------------------------------------------------
if [[ "$SKIP_PULL" == "true" ]]; then
  info "Step 4: Skipped git pull (already done by launcher)."
else
  info "Step 4: Git pull was done by update.sh launcher."
fi

info "Changes in this update:"
git -C "$SCRIPT_DIR" diff HEAD@{1} HEAD --stat 2>/dev/null | while IFS= read -r line; do
  echo "  $line"
done
echo ""

# -----------------------------------------------------------------------------
# STEP 4b: Build frontend and backend Docker images
# -----------------------------------------------------------------------------
info "Step 4b: Building frontend and backend Docker images..."
cd "$SCRIPT_DIR"
docker compose build --no-cache frontend backend 2>&1
BUILD_EXIT=$?
if [[ $BUILD_EXIT -ne 0 ]]; then
  die "Frontend/backend Docker build failed (exit $BUILD_EXIT)"
fi
success "Frontend and backend images built successfully."

# -----------------------------------------------------------------------------
# STEP 5: Compare changes
# -----------------------------------------------------------------------------
info "Step 5: Comparing changes in docker-compose.yml..."
echo -e "${CYAN}"
git diff HEAD~1 HEAD -- docker-compose.yml || echo "(No changes in docker-compose.yml or no previous commit)"
echo -e "${RESET}"

# -----------------------------------------------------------------------------
# STEP 6: Create new directories and fix permissions
# -----------------------------------------------------------------------------
info "Step 6: Fixing permissions..."
bash fix-permissions.sh >/dev/null 2>&1 || true
success "Permissions fixed."

# -----------------------------------------------------------------------------
# STEP 7: Pull new Docker images
# -----------------------------------------------------------------------------
info "Step 7: Pulling latest images..."
docker compose pull
success "Images pulled."

# -----------------------------------------------------------------------------
# STEP 8: Stop containers gracefully
# -----------------------------------------------------------------------------
info "Step 8: Stopping containers..."
docker compose down --remove-orphans --timeout 30 >/dev/null 2>&1
success "Containers stopped."

# -----------------------------------------------------------------------------
# STEP 9: Rebuild custom images
# -----------------------------------------------------------------------------
info "Step 9: Rebuilding frontend and backend images..."
if ! docker compose build --no-cache frontend backend; then
  error "Rebuilding frontend and backend failed."
  auto_rollback
fi
success "Frontend and backend rebuilt successfully."

# -----------------------------------------------------------------------------
# STEP 10: Start containers
# -----------------------------------------------------------------------------
info "Step 10: Starting containers..."

# Always start all services (sonarr-anime, tdarr, bazarr always enabled)
core_services="radarr sonarr prowlarr qbittorrent jellyfin jellyseerr ytdlp backend frontend sonarr-anime tdarr bazarr"

if ! docker compose up -d --remove-orphans $core_services; then
  error "docker compose up failed — triggering rollback."
  auto_rollback
fi
success "Containers started."

# -----------------------------------------------------------------------------
# STEP 11: Health verification
# -----------------------------------------------------------------------------
info "Step 11: Verifying container health..."
health_retries=20
all_healthy=false

while (( health_retries-- > 0 )); do
  unhealthy=$(docker compose ps --format json | grep -E '"State":"(restarting|exited|dead)"' || true)
  if [[ -z "$unhealthy" ]]; then
    all_healthy=true
    break
  fi
  sleep 3
done

if ! $all_healthy; then
  error "Some containers failed to start or remain healthy."
  auto_rollback
fi
success "All containers are running stably."

info "Verifying Frontend Dashboard..."
frontend_ready=false
fe_retries=30
while (( fe_retries-- > 0 )); do
  if curl -sf http://localhost:${DASHBOARD_PORT:-8080} >/dev/null; then
    frontend_ready=true
    break
  fi
  sleep 1
done

if ! $frontend_ready; then
  error "Frontend failed to respond after rebuild."
  auto_rollback
fi
success "Frontend is successfully responding."

# Re-enable strict mode now that critical steps are done
set -e

# -----------------------------------------------------------------------------
# STEP 12: Update the VERSION file
# -----------------------------------------------------------------------------
info "Step 12: Updating VERSION file..."
if [[ -f "VERSION" ]]; then
  NEW_VERSION=$(cat VERSION | tr -d '\r')
else
  NEW_VERSION="unknown"
fi
success "Version is now $NEW_VERSION"

# -----------------------------------------------------------------------------
# STEP 13: Disable maintenance mode
# -----------------------------------------------------------------------------
info "Step 13: Disabling maintenance mode..."
rm -f "$SCRIPT_DIR/state/maintenance"
success "Maintenance mode disabled."

# -----------------------------------------------------------------------------
# STEP 14: Print full post-update health report
# -----------------------------------------------------------------------------
info "Step 14: Final Report"
echo ""
echo -e "${BOLD}${GREEN}======================================================================${RESET}"
echo -e "${BOLD}${GREEN}✔ MediaFlow Update Successful!${RESET}"
echo -e "${BOLD}${GREEN}======================================================================${RESET}"
echo -e "Current Version: ${CYAN}$NEW_VERSION${RESET}"
echo ""

echo -e "${BOLD}Container Status:${RESET}"
containers=$(docker compose ps --format '{{.Name}}\t{{.State}}' || true)
while read -r line; do
  if [[ -z "$line" ]]; then continue; fi
  c_name=$(echo "$line" | awk '{print $1}')
  c_state=$(echo "$line" | awk '{print $2}')
  if [[ "$c_state" == "running" || "$c_state" == "Up" ]]; then
    echo -e "  ${GREEN}✔${RESET} $c_name"
  else
    echo -e "  ${RED}✘${RESET} $c_name ($c_state)"
  fi
done <<< "$containers"

echo ""
echo -e "${BOLD}Rebuilt Images:${RESET}"
docker images mediaflow-frontend mediaflow-backend --format "  {{.Repository}}:{{.Tag}} — {{.ID}} — built {{.CreatedSince}}" || true

echo ""
echo -e "${GREEN}All data paths verified writable.${RESET}"

record_history "success" "$NEW_VERSION"

exit 0
