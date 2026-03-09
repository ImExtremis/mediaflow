#!/usr/bin/env bash
# =============================================================================
#  MediaFlow · uninstall.sh
#  Cleanly removes the MediaFlow stack and optionally all data
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
die()     { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${BOLD}${RED}MediaFlow Uninstaller${RESET}"
echo -e "Install directory: ${CYAN}$INSTALL_DIR${RESET}"
echo ""
echo -e "${YELLOW}WARNING: This will stop and remove all MediaFlow containers.${RESET}"
read -rp "Are you sure you want to continue? [y/N]: " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { info "Uninstall cancelled."; exit 0; }

# Stop and remove containers
info "Stopping MediaFlow containers..."
cd "$INSTALL_DIR"
docker compose down --remove-orphans 2>/dev/null || true
success "Containers stopped and removed"

# Ask about images
echo ""
read -rp "$(echo -e "${YELLOW}Remove downloaded Docker images? [y/N]: ${RESET}")" remove_images
if [[ "$remove_images" =~ ^[Yy]$ ]]; then
  info "Removing Docker images..."
  docker compose down --rmi all 2>/dev/null || true
  success "Docker images removed"
fi

# Ask about volumes (DATA)
echo ""
echo -e "${RED}${BOLD}⚠  WARNING: Removing volumes will delete ALL service configuration data!${RESET}"
echo -e "    This includes Sonarr, Radarr, Prowlarr, qBittorrent, and Jellyfin settings."
read -rp "$(echo -e "${RED}Remove Docker volumes (config data)? [y/N]: ${RESET}")" remove_volumes
if [[ "$remove_volumes" =~ ^[Yy]$ ]]; then
  info "Removing Docker volumes..."
  docker compose down --volumes 2>/dev/null || true
  # Also remove named volumes explicitly
  docker volume rm mediaflow_sonarr_config mediaflow_radarr_config \
    mediaflow_prowlarr_config mediaflow_qbittorrent_config \
    mediaflow_jellyfin_config mediaflow_jellyfin_cache \
    mediaflow_bazarr_config mediaflow_sonarr_anime_config \
    mediaflow_overseerr_config mediaflow_tdarr_config mediaflow_tdarr_server_config 2>/dev/null || true
  success "Docker volumes removed"
fi

# Remove firewall rules
if command -v ufw &>/dev/null && sudo ufw status | grep -q "Status: active"; then
  info "Removing UFW firewall rules..."
  for port in 8080 7878 8989 9696 8082 8096 6767 8990 5055 8265 8266; do
    sudo ufw delete allow "$port/tcp" 2>/dev/null || true
  done
  success "UFW rules removed"
fi

echo ""
echo -e "${GREEN}${BOLD}MediaFlow has been uninstalled successfully.${RESET}"
echo -e "Your media files at ${CYAN}$(grep MEDIA_PATH "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2 || echo '/mnt/media')${RESET} were ${BOLD}not${RESET} touched."
echo ""
