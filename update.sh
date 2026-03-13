#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_SCRIPT="$SCRIPT_DIR/scripts/do-update.sh"

# Self-heal state, backups, and logs directory permissions before doing anything
# Ensures the updater always works even after fresh installs or permission resets
mkdir -p "$SCRIPT_DIR/state" "$SCRIPT_DIR/backups" "$SCRIPT_DIR/logs"
chmod 775 "$SCRIPT_DIR/state" "$SCRIPT_DIR/backups" "$SCRIPT_DIR/logs" 2>/dev/null || true
chown "$(whoami):$(whoami)" "$SCRIPT_DIR/state" "$SCRIPT_DIR/backups" "$SCRIPT_DIR/logs" 2>/dev/null || true


# Require password if not already authenticated
if [[ "${MEDIAFLOW_AUTH:-}" != "1" ]]; then
  read -rsp "MediaFlow update password: " PASSWORD
  echo ""
  STORED=$(grep "^UPDATE_PASSWORD=" "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "")
  if [[ "$PASSWORD" != "$STORED" ]]; then
    echo "[ERROR] Incorrect password"
    exit 1
  fi
  export MEDIAFLOW_AUTH=1
fi

# Pull latest code
echo "[INFO] Fetching latest MediaFlow..."
git -C "$SCRIPT_DIR" fetch origin main --quiet
LOCAL=$(git -C "$SCRIPT_DIR" rev-parse HEAD)
REMOTE=$(git -C "$SCRIPT_DIR" rev-parse origin/main)

if [[ "$LOCAL" == "$REMOTE" ]]; then
  echo "[INFO] Already up to date."
  exit 0
fi

git -C "$SCRIPT_DIR" pull origin main --quiet

# Hand off to the updated do-update.sh
if [[ ! -f "$UPDATE_SCRIPT" ]]; then
  echo "[ERROR] do-update.sh not found after pull"
  exit 1
fi

chmod +x "$UPDATE_SCRIPT"
exec bash "$UPDATE_SCRIPT" "$@"
