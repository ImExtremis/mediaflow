#!/usr/bin/env bash
# =============================================================================
#  MediaFlow · backup.sh
#  Backup and restore config.json + arr-stack appdata
#  Usage:
#    bash backup.sh              – interactive backup
#    bash backup.sh --auto       – silent auto backup
#    bash backup.sh restore <file.tar.gz>  – restore from archive
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
die()     { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$INSTALL_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="mediaflow_backup_${TIMESTAMP}.tar.gz"

do_backup() {
  local auto="${1:-}"
  mkdir -p "$BACKUP_DIR"

  if [[ "$auto" != "--auto" ]]; then
    echo ""
    echo -e "${BOLD}${CYAN}MediaFlow Backup${RESET}"
    echo -e "Backup directory: ${CYAN}$BACKUP_DIR${RESET}"
    echo ""
  fi

  info "Creating backup: ${BOLD}$ARCHIVE_NAME${RESET}"

  # Collect items to backup
  local items=()
  [[ -f "$INSTALL_DIR/config/config.json" ]] && items+=("config/config.json")
  [[ -f "$INSTALL_DIR/.env" ]]               && items+=(".env")
  [[ -f "$INSTALL_DIR/docker-compose.yml" ]] && items+=("docker-compose.yml")

  if [[ ${#items[@]} -eq 0 ]]; then
    die "Nothing to back up. Is MediaFlow installed?"
  fi

  # Create archive
  cd "$INSTALL_DIR"
  tar -czf "$BACKUP_DIR/$ARCHIVE_NAME" "${items[@]}"

  local size
  size=$(du -sh "$BACKUP_DIR/$ARCHIVE_NAME" | cut -f1)
  success "Backup created: ${CYAN}$BACKUP_DIR/$ARCHIVE_NAME${RESET} (${size})"

  # Keep only last 10 backups
  local backup_count
  backup_count=$(ls -1 "$BACKUP_DIR"/mediaflow_backup_*.tar.gz 2>/dev/null | wc -l)
  if (( backup_count > 10 )); then
    info "Pruning old backups (keeping last 10)..."
    ls -1t "$BACKUP_DIR"/mediaflow_backup_*.tar.gz | tail -n +11 | xargs rm -f
  fi

  if [[ "$auto" != "--auto" ]]; then
    echo ""
    echo -e "  Restore with: ${CYAN}bash backup.sh restore $BACKUP_DIR/$ARCHIVE_NAME${RESET}"
    echo ""
  fi
}

do_restore() {
  local archive="${1:-}"
  [[ -z "$archive" ]] && die "Usage: bash backup.sh restore <archive.tar.gz>"
  [[ ! -f "$archive" ]] && die "Archive not found: $archive"

  echo ""
  echo -e "${BOLD}${YELLOW}MediaFlow Restore${RESET}"
  echo -e "Restoring from: ${CYAN}$archive${RESET}"
  echo ""
  echo -e "${YELLOW}WARNING: This will overwrite your current config.json and .env!${RESET}"
  read -rp "Continue? [y/N]: " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { info "Restore cancelled."; exit 0; }

  # Create a pre-restore backup first
  info "Creating pre-restore backup..."
  do_backup --auto

  info "Stopping services before restore..."
  cd "$INSTALL_DIR"
  docker compose stop backend frontend 2>/dev/null || true

  info "Extracting archive..."
  tar -xzf "$archive" -C "$INSTALL_DIR"
  success "Config restored from archive"

  info "Restarting services..."
  docker compose up -d backend frontend

  echo ""
  success "Restore complete!"
  echo ""
}

# ─── Entry Point ─────────────────────────────────────────────────────────────
case "${1:-backup}" in
  restore)
    do_restore "${2:-}"
    ;;
  --auto)
    do_backup "--auto"
    ;;
  backup|"")
    do_backup
    ;;
  *)
    echo "Usage: bash backup.sh [backup|restore <file>|--auto]"
    exit 1
    ;;
esac
