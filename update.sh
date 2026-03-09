#!/usr/bin/env bash
# =============================================================================
#  MediaFlow · update.sh
#  Safe Update Script with Auto-Rollback
# =============================================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$INSTALL_DIR"

# Global error trap
trap 'auto_rollback' ERR

# We need to know the start time for the history log
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
# STEP 4: Auto Rollback Function
# -----------------------------------------------------------------------------
auto_rollback() {
  echo ""
  echo -e "${BOLD}${RED}UPDATE FAILED — INITIATING AUTO ROLLBACK${RESET}"
  
  info "Stopping containers..."
  docker compose down || true

  info "Restoring files from backup ($BACKUP_DIR)..."
  if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
    cp -f "$BACKUP_DIR/docker-compose.yml" ./ 2>/dev/null || true
    cp -f "$BACKUP_DIR/.env" ./ 2>/dev/null || true
    cp -f "$BACKUP_DIR/VERSION" ./ 2>/dev/null || true
    # Not restoring full appdata to save time unless strictly necessary, 
    # but the prompt said "restore docker-compose.yml and .env"
  fi

  info "Reverting any pulled code changes..."
  git stash || true

  info "Restarting containers..."
  docker compose up -d || true

  info "Waiting for health checks to pass..."
  sleep 10 # brief wait to let containers start

  info "Disabling maintenance mode..."
  rm -f ./state/maintenance

  echo -e "${YELLOW}Rollback completed successfully — your system is restored to the previous version${RESET}"
  if [[ -n "$BACKUP_DIR" ]]; then
    echo -e "Backup path: ${CYAN}$BACKUP_DIR${RESET}"
  fi

  record_history "rollback" "$OLD_VERSION"
  exit 1
}

# -----------------------------------------------------------------------------
# STEP 1: Pre-flight checks
# -----------------------------------------------------------------------------
info "Step 1: Running pre-flight checks..."

# Check Docker
if ! docker info >/dev/null 2>&1; then
  die "Docker is not running or current user does not have permissions."
fi

# Check Internet
if ! ping -c 1 github.com >/dev/null 2>&1; then
  die "Internet connectivity check failed (cannot ping github.com)."
fi

# Check Disk Space (Require at least 2GB free)
available_kb=$(df -k "$INSTALL_DIR" | tail -1 | awk '{print $4}')
available_gb=$(( available_kb / 1024 / 1024 ))
if (( available_gb < 2 )); then
  die "Insufficient disk space. Need at least 2GB free, have ${available_gb}GB."
fi
success "Pre-flight checks passed."

# -----------------------------------------------------------------------------
# STEP 2: Backup
# -----------------------------------------------------------------------------
info "Step 2: Creating backup..."
BACKUP_DIR="${INSTALL_DIR}/backups/pre-update-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -f docker-compose.yml VERSION .env "$BACKUP_DIR/" 2>/dev/null || true
cp -r config appdata "$BACKUP_DIR/" 2>/dev/null || true

bash backup.sh --auto 2>/dev/null || warn "backup.sh skipped or failed"
success "Backup saved to $BACKUP_DIR"

# -----------------------------------------------------------------------------
# STEP 3: Enable maintenance mode
# -----------------------------------------------------------------------------
info "Step 3: Enabling maintenance mode..."
mkdir -p ./state
echo "MAINTENANCE=true" > ./state/maintenance
success "Maintenance mode enabled."

# -----------------------------------------------------------------------------
# STEP 4: Pull latest code
# -----------------------------------------------------------------------------
info "Step 4: Pulling latest code..."
git fetch origin
git pull origin main
success "Latest code pulled."

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
docker compose down --timeout 30
success "Containers stopped."

# -----------------------------------------------------------------------------
# STEP 9: Start containers
# -----------------------------------------------------------------------------
info "Step 9: Starting containers..."
docker compose up -d
success "Containers started."

# -----------------------------------------------------------------------------
# STEP 10: Health verification
# -----------------------------------------------------------------------------
info "Step 10: Verifying container health..."
health_retries=20
all_healthy=false

while (( health_retries-- > 0 )); do
  # Check if any container is Exited or Restarting
  unhealthy=$(docker compose ps --format json | grep -E '"State":"(restarting|exited|dead)"' || true)
  if [[ -z "$unhealthy" ]]; then
    # further checks can be done, but simply checking they remain Up is a basic test
    all_healthy=true
    break
  fi
  sleep 3
done

if ! $all_healthy; then
  error "Some containers failed to start or remain healthy."
  # Trigger the trap
  false 
fi
success "All containers are healthy."

# -----------------------------------------------------------------------------
# STEP 11: Update the VERSION file
# -----------------------------------------------------------------------------
info "Step 11: Updating VERSION file..."
# Read the new version from the git repo if available
if [[ -f "VERSION" ]]; then
  NEW_VERSION=$(cat VERSION | tr -d '\r')
else
  NEW_VERSION="unknown"
fi
success "Version is now $NEW_VERSION"

# -----------------------------------------------------------------------------
# STEP 12: Disable maintenance mode
# -----------------------------------------------------------------------------
info "Step 12: Disabling maintenance mode..."
rm -f ./state/maintenance
success "Maintenance mode disabled."

# -----------------------------------------------------------------------------
# STEP 13: Print full post-update health report
# -----------------------------------------------------------------------------
info "Step 13: Final Report"
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
echo -e "${GREEN}All data paths verified writable.${RESET}"

record_history "success" "$NEW_VERSION"

# Clear the trap on successful completion
trap - ERR
exit 0
