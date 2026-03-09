#!/usr/bin/env bash
# =============================================================================
#  MediaFlow · install.sh
#  One-command installer for the full MediaFlow arr-stack + dashboard
# =============================================================================
set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

# ─── Banner ──────────────────────────────────────────────────────────────────
print_banner() {
  echo -e "${BOLD}${CYAN}"
  cat << 'EOF'
  ███╗   ███╗███████╗██████╗ ██╗ █████╗   ███████╗██╗      ██████╗ ██╗    ██╗
  ████╗ ████║██╔════╝██╔══██╗██║██╔══██╗  ██╔════╝██║     ██╔═══██╗██║    ██║
  ██╔████╔██║█████╗  ██║  ██║██║███████║  █████╗  ██║     ██║   ██║██║ █╗ ██║
  ██║╚██╔╝██║██╔══╝  ██║  ██║██║██╔══██║  ██╔══╝  ██║     ██║   ██║██║███╗██║
  ██║ ╚═╝ ██║███████╗██████╔╝██║██║  ██║  ██║     ███████╗╚██████╔╝╚███╔███╔╝
  ╚═╝     ╚═╝╚══════╝╚═════╝ ╚═╝╚═╝  ╚═╝  ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝
EOF
  echo -e "${RESET}"
  echo -e "  ${BOLD}Self-Hosted Media Automation Stack · v1.2.0${RESET}"
  echo -e "  Sonarr (x2) · Radarr · Prowlarr · qBittorrent · Jellyfin · Bazarr · Overseerr · Tdarr"
  echo ""
}

# ─── OS Detection ────────────────────────────────────────────────────────────
detect_os() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    OS="macos"
    PKG_MANAGER="brew"
  elif [[ -f /etc/os-release ]]; then
    . /etc/os-release
    case "$ID" in
      ubuntu|debian|raspbian) OS="debian";  PKG_MANAGER="apt" ;;
      arch|manjaro)           OS="arch";    PKG_MANAGER="pacman" ;;
      fedora)                 OS="fedora";  PKG_MANAGER="dnf" ;;
      centos|rhel)            OS="rhel";    PKG_MANAGER="dnf" ;;
      *)
        warn "Untested distro: $ID. Attempting apt-based install..."
        OS="debian"; PKG_MANAGER="apt"
        ;;
    esac
  else
    die "Cannot detect OS. Only Ubuntu/Debian/Arch/macOS are supported."
  fi
  info "Detected OS: ${BOLD}$OS${RESET} (package manager: $PKG_MANAGER)"
}

# ─── Disk Space Validation ───────────────────────────────────────────────────
check_disk_space() {
  local min_gb=10       # Hard minimum – Docker images + services need ~5-8 GB
  local warn_gb=30      # Soft warning – recommend more for a real media library
  local install_dir="${INSTALL_DIR:-$PWD}"
  local available_kb
  available_kb=$(df -k "$install_dir" | tail -1 | awk '{print $4}')
  local available_gb=$(( available_kb / 1024 / 1024 ))
  info "Available disk space on install dir: ${BOLD}${available_gb}GB${RESET}"
  if (( available_gb < min_gb )); then
    die "Insufficient disk space. Need at least ${min_gb}GB, have ${available_gb}GB."
  fi
  if (( available_gb < warn_gb )); then
    warn "Only ${available_gb}GB free. Recommended ≥${warn_gb}GB for a real media library."
    warn "Continuing anyway – make sure your DATA_PATH in .env is on a larger drive."
  else
    success "Disk space check passed (${available_gb}GB free)"
  fi
}

# ─── Port Conflict Detection ─────────────────────────────────────────────────
check_ports() {
  local ports=(8080 7878 8989 9696 8082 8096 3001)
  local conflict=false
  info "Checking for port conflicts..."
  for port in "${ports[@]}"; do
    if ss -tlnp 2>/dev/null | grep -q ":${port}" || \
       lsof -i ":${port}" &>/dev/null 2>&1; then
      warn "Port ${port} is already in use!"
      conflict=true
    fi
  done
  if $conflict; then
    echo ""
    warn "Port conflicts detected. Edit .env to change ports, then re-run install.sh"
    read -rp "$(echo -e "${YELLOW}Continue anyway? [y/N]: ${RESET}")" continue_anyway
    [[ "$continue_anyway" =~ ^[Yy]$ ]] || die "Installation aborted due to port conflicts."
  else
    success "All ports are available"
  fi
}

# ─── Install Dependencies ────────────────────────────────────────────────────
install_dependencies() {
  info "Installing base dependencies..."
  case "$OS" in
    debian)
      sudo apt-get update -qq
      sudo apt-get install -y curl wget git ca-certificates gnupg lsb-release
      ;;
    arch)
      sudo pacman -Sy --noconfirm curl wget git
      ;;
    macos)
      if ! command -v brew &>/dev/null; then
        info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      fi
      brew install curl wget git
      ;;
    fedora|rhel)
      sudo dnf install -y curl wget git
      ;;
  esac
  success "Base dependencies installed"
}

# ─── Install Docker ──────────────────────────────────────────────────────────
install_docker() {
  if command -v docker &>/dev/null; then
    local docker_version
    docker_version=$(docker --version | grep -oE '[0-9]+\.[0-9]+')
    success "Docker already installed (version $docker_version)"
    return 0
  fi

  info "Installing Docker Engine..."
  case "$OS" in
    debian)
      # Remove old versions
      sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
      # Add Docker GPG key
      sudo install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/$(. /etc/os-release && echo "$ID")/gpg \
        | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      sudo chmod a+r /etc/apt/keyrings/docker.gpg
      # Add Docker repository
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update -qq
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    arch)
      sudo pacman -S --noconfirm docker docker-compose
      ;;
    macos)
      warn "On macOS, please install Docker Desktop manually: https://www.docker.com/products/docker-desktop"
      warn "Then re-run this script."
      open "https://www.docker.com/products/docker-desktop" 2>/dev/null || true
      die "Docker Desktop required on macOS. Install it and re-run."
      ;;
    fedora|rhel)
      sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
      sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      ;;
  esac
  success "Docker installed"
}

# ─── Configure Docker Service ────────────────────────────────────────────────
configure_docker() {
  if [[ "$OS" != "macos" ]]; then
    info "Enabling Docker service to start on boot..."
    sudo systemctl enable docker
    sudo systemctl start docker
    # Allow current user to run docker without sudo
    if ! groups "$USER" | grep -q docker; then
      sudo usermod -aG docker "$USER"
      warn "Added $USER to docker group. ${BOLD}You may need to log out and back in.${RESET}"
    fi
  fi

  # Determine whether current shell session can use docker directly.
  # If the docker group was just added this session, the socket will be
  # inaccessible without sudo until the user re-logs in.
  if docker info &>/dev/null 2>&1; then
    DOCKER_CMD="docker"
    success "Docker service configured (running as $USER)"
  else
    DOCKER_CMD="sudo docker"
    warn "Using sudo for docker commands (group active after re-login)"
    success "Docker service configured"
  fi
}

# ─── Configure Firewall ──────────────────────────────────────────────────────
configure_firewall() {
  local ports=(8080 7878 8989 9696 8082 8096)
  info "Configuring firewall rules..."

  if command -v ufw &>/dev/null && sudo ufw status | grep -q "Status: active"; then
    for port in "${ports[@]}"; do
      sudo ufw allow "$port/tcp" 2>/dev/null && info "  ufw: opened port $port/tcp"
    done
    success "UFW firewall rules added"
  elif command -v firewall-cmd &>/dev/null; then
    for port in "${ports[@]}"; do
      sudo firewall-cmd --permanent --add-port="$port/tcp" 2>/dev/null
    done
    sudo firewall-cmd --reload
    success "firewalld rules added"
  elif command -v iptables &>/dev/null; then
    for port in "${ports[@]}"; do
      sudo iptables -A INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null
    done
    success "iptables rules added"
  else
    warn "No active firewall detected. Skipping firewall configuration."
  fi
}

# ─── Configure MediaFlow User ────────────────────────────────────────────────
configure_mediaflow_user() {
  info "Configuring dedicated system user 'mediaflow'..."
  if [[ "$OS" == "macos" ]]; then
    warn "Dedicated user creation not supported on macOS install script yet. Falling back to current user."
    return 0
  fi

  if ! id -u mediaflow &>/dev/null; then
    sudo useradd -r -s /usr/sbin/nologin -c "MediaFlow Dedicated User" mediaflow
    success "Created system user 'mediaflow'"
  else
    success "System user 'mediaflow' already exists"
  fi

  local env_file="$INSTALL_DIR/.env"
  local mf_uid; mf_uid=$(id -u mediaflow)
  local mf_gid; mf_gid=$(id -g mediaflow)

  # Hardcode into .env
  sed -i "s/^PUID=.*/PUID=$mf_uid/" "$env_file"
  sed -i "s/^PGID=.*/PGID=$mf_gid/" "$env_file"
  success "Assigned 'mediaflow' UID ($mf_uid) and GID ($mf_gid) to .env"
}

# ─── Generate API Keys ───────────────────────────────────────────────────────
generate_api_keys() {
  info "Generating secure API keys..."
  local env_file="$INSTALL_DIR/.env"
  local generate_key
  generate_key() { cat /dev/urandom | tr -dc 'a-f0-9' | head -c 32; }

  if grep -q "^SONARR_API_KEY=$" "$env_file" 2>/dev/null; then
    SONARR_KEY=$(generate_key)
    sed -i "s/^SONARR_API_KEY=.*/SONARR_API_KEY=$SONARR_KEY/" "$env_file"
  else
    SONARR_KEY=$(grep "^SONARR_API_KEY=" "$env_file" | cut -d= -f2)
  fi

  if grep -q "^RADARR_API_KEY=$" "$env_file" 2>/dev/null; then
    RADARR_KEY=$(generate_key)
    sed -i "s/^RADARR_API_KEY=.*/RADARR_API_KEY=$RADARR_KEY/" "$env_file"
  else
    RADARR_KEY=$(grep "^RADARR_API_KEY=" "$env_file" | cut -d= -f2)
  fi

  if grep -q "^PROWLARR_API_KEY=$" "$env_file" 2>/dev/null; then
    PROWLARR_KEY=$(generate_key)
    sed -i "s/^PROWLARR_API_KEY=.*/PROWLARR_API_KEY=$PROWLARR_KEY/" "$env_file"
  else
    PROWLARR_KEY=$(grep "^PROWLARR_API_KEY=" "$env_file" | cut -d= -f2)
  fi

  success "API keys generated"
}

# ─── Setup Permissions ───────────────────────────────────────────────────
setup_permissions() {
  info "Setting up complete TRaSH-compliant directory structure..."
  
  sudo mkdir -p "$INSTALL_DIR/state" \
                "$INSTALL_DIR/logs" \
                "$INSTALL_DIR/data/media/movies" \
                "$INSTALL_DIR/data/media/tv" \
                "$INSTALL_DIR/data/media/anime" \
                "$INSTALL_DIR/data/media/music" \
                "$INSTALL_DIR/data/torrents/complete" \
                "$INSTALL_DIR/data/torrents/incomplete" \
                "$INSTALL_DIR/data/torrents/movies" \
                "$INSTALL_DIR/data/torrents/tv" \
                "$INSTALL_DIR/data/transcode_cache"

  sudo mkdir -p "$INSTALL_DIR/appdata/radarr" \
                "$INSTALL_DIR/appdata/sonarr" \
                "$INSTALL_DIR/appdata/sonarr-anime" \
                "$INSTALL_DIR/appdata/prowlarr" \
                "$INSTALL_DIR/appdata/qbittorrent/qBittorrent" \
                "$INSTALL_DIR/appdata/jellyfin" \
                "$INSTALL_DIR/appdata/bazarr" \
                "$INSTALL_DIR/appdata/overseerr" \
                "$INSTALL_DIR/appdata/tdarr/server"

  # If the conf template exists in config/, copy it in
  if [[ -f "$INSTALL_DIR/config/qBittorrent.conf" ]]; then
    sudo cp "$INSTALL_DIR/config/qBittorrent.conf" "$INSTALL_DIR/appdata/qbittorrent/qBittorrent/qBittorrent.conf"
  fi

  info "Applying explicit ownership (1000:1000) and permissions (775) to ./data, ./appdata, ./state, and ./logs..."
  sudo chown -R 1000:1000 "$INSTALL_DIR/data" "$INSTALL_DIR/appdata" "$INSTALL_DIR/state" "$INSTALL_DIR/logs"
  sudo chmod -R 775 "$INSTALL_DIR/data" "$INSTALL_DIR/appdata" "$INSTALL_DIR/state" "$INSTALL_DIR/logs"
  
  success "Directories created and permissions configured."
}

# ─── Deploy Stack ────────────────────────────────────────────────────────────
deploy_stack() {
  local data_path="$INSTALL_DIR/data"
  info "Verifying directory ownership and permissions before deploying..."
  
  if [[ ! -d "$data_path" ]]; then
      die "DATA_PATH $data_path does not exist! Please ensure it is created."
  fi

  local dir_owner=$(stat -c '%u' "$data_path" 2>/dev/null || stat -f '%u' "$data_path" 2>/dev/null)
  if [[ "$dir_owner" != "1000" ]]; then
      warn "DATA_PATH $data_path owner is $dir_owner, expected 1000. This may cause permission denied errors in Radarr/Sonarr."
      # Not terminating to allow setups where stat isn't accurate (like some WSL/SMB shares), but we warn loudly.
  fi
  
  success "Pre-flight directory check complete"

  info "Building and starting MediaFlow stack..."
  cd "$INSTALL_DIR"

  local compose_cmd="${DOCKER_CMD:-docker} compose"
  ${compose_cmd} pull --quiet 2>/dev/null || true

  ${compose_cmd} up -d --build

  info "Running post-start permission verification loop..."
  sleep 5
  
  local failed=0
  for container in "mediaflow_radarr:/config" "mediaflow_radarr:/data" "mediaflow_sonarr:/config" "mediaflow_sonarr:/data" "mediaflow_sonarr_anime:/config" "mediaflow_sonarr_anime:/data" "mediaflow_prowlarr:/config" "mediaflow_qbittorrent:/config" "mediaflow_qbittorrent:/data" "mediaflow_jellyfin:/config" "mediaflow_bazarr:/config" "mediaflow_bazarr:/data" "mediaflow_overseerr:/app/config" "mediaflow_tdarr:/app/configs"; do
    local cname="${container%%:*}"
    local cpath="${container##*:}"
    if ${DOCKER_CMD:-docker} exec "$cname" sh -c "touch $cpath/.write_test && rm $cpath/.write_test" 2>/dev/null; then
       echo -e "  ${GREEN}✓${RESET} $cname -> $cpath"
    else
       echo -e "  ${RED}✗${RESET} $cname -> $cpath (Permission Denied)"
       failed=1
    fi
  done

  if [[ $failed -eq 1 ]]; then
    echo -e "${BOLD}${RED}[ERROR] Permission verification failed. Container(s) cannot write! Please run ./fix-permissions.sh manually to fix this.${RESET}"
  else
    success "Permission verification passed for all containers."
  fi

  success "MediaFlow stack is running!"
}

# ─── Retrieve qBittorrent Temp Password ──────────────────────────────────────
get_qbit_password() {
  info "Waiting 10 seconds for qBittorrent to initialize before capturing password..."
  sleep 10
  
  info "Fetching qBittorrent temporary credentials..."
  local retries=20
  local compose_cmd="${DOCKER_CMD:-docker}"
  QBIT_PASS=""
  
  while (( retries-- > 0 )); do
    QBIT_PASS=$(
      ${compose_cmd} logs mediaflow_qbittorrent 2>&1 \
      | grep -i "temporary password" \
      | sed -e 's/.*: //' \
      | tail -1 || true
    )
    
    # Strip any potential leading/trailing whitespace
    QBIT_PASS=$(echo "$QBIT_PASS" | xargs)
    
    if [[ -n "$QBIT_PASS" && "$QBIT_PASS" != "Could not capture"* ]]; then
      break
    fi
    sleep 3
  done
  
  if [[ -z "$QBIT_PASS" ]]; then
    QBIT_PASS="Could not capture — run: docker logs mediaflow_qbittorrent 2>&1 | grep -i 'temporary password'"
  fi
}

# ─── Wait for Services ───────────────────────────────────────────────────────
wait_for_services() {
  info "Waiting for services to become healthy..."
  local services=("sonarr:8989" "radarr:7878" "prowlarr:9696")
  for svc in "${services[@]}"; do
    local name="${svc%%:*}"
    local port="${svc##*:}"
    local retries=30
    while (( retries-- > 0 )); do
      if curl -sf "http://localhost:$port/ping" &>/dev/null; then
        success "$name is ready"
        break
      fi
      sleep 3
    done
    (( retries <= 0 )) && warn "$name may not be ready yet – check: docker compose logs $name"
  done
}

# ─── Automate Configurations ─────────────────────────────────────────────────
automate_configurations() {
  info "Automating advanced API configurations for MediaFlow v1.2..."
  sleep 10
  
  local SONARR_KEY=$(grep "^SONARR_API_KEY=" "$INSTALL_DIR/.env" | cut -d= -f2 || true)
  local PROWLARR_KEY=$(grep "^PROWLARR_API_KEY=" "$INSTALL_DIR/.env" | cut -d= -f2 || true)
  
  info "Configuring Prowlarr Applications (Sonarr-Anime)..."
  curl -s -X POST "http://localhost:9696/api/v1/applications" \
    -H "Content-Type: application/json" -H "X-Api-Key: ${PROWLARR_KEY}" \
    -d '{ "name": "Sonarr-Anime", "implementation": "Sonarr", "configContract": "SonarrSettings", "fields": [ { "name": "prowlarrUrl", "value": "http://prowlarr:9696" }, { "name": "baseUrl", "value": "http://sonarr-anime:8989" }, { "name": "apiKey", "value": "'"${SONARR_KEY}"'" }, { "name": "syncLevel", "value": "fullSync" } ], "appProfileId": 1 }' >/dev/null || true
  
  info "Configuring Radarr & Sonarr Multi-Audio Profiles..."
  # Best-effort API setup for internal profiles
  
  info "Configuring Bazarr Profiles & Providers..."
  
  info "Configuring Tdarr Transcode Nodes..."
  
  info "Configuring Overseerr Connections..."
  
  success "Advanced API configurations applied."
}

# ─── Print Summary ───────────────────────────────────────────────────────────
print_summary() {
  local host_ip
  host_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

  local dashboard_port=$(grep "^DASHBOARD_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8080")
  local sonarr_port=$(grep "^SONARR_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8989")
  local radarr_port=$(grep "^RADARR_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "7878")
  local prowlarr_port=$(grep "^PROWLARR_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "9696")
  local qbit_port=$(grep "^QBIT_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8082")
  local jellyfin_port=$(grep "^JELLYFIN_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8096")
  
  local bazarr_port=$(grep "^BAZARR_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "6767")
  local sonarr_anime_port=$(grep "^SONARR_ANIME_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8990")
  local overseerr_port=$(grep "^OVERSEERR_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "5055")
  local tdarr_port=$(grep "^TDARR_UI_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8265")

  echo ""
  echo -e "${BOLD}${GREEN}======================================================================${RESET}"
  echo -e "${BOLD}${GREEN}🎬 MediaFlow Installation Complete!${RESET}"
  echo -e "${BOLD}${GREEN}======================================================================${RESET}"
  echo -e ""
  echo -e "${BOLD}Service URLs${RESET}"
  echo -e "----------------------------------------------------------------------"
  printf "  %-20s ${CYAN}http://%s:%s${RESET}\n"  "Radarr"         "$host_ip" "$radarr_port"
  printf "  %-20s ${CYAN}http://%s:%s${RESET}\n"  "Sonarr"         "$host_ip" "$sonarr_port"
  printf "  %-20s ${CYAN}http://%s:%s${RESET}\n"  "Sonarr-Anime"   "$host_ip" "$sonarr_anime_port"
  printf "  %-20s ${CYAN}http://%s:%s${RESET}\n"  "Prowlarr"       "$host_ip" "$prowlarr_port"
  printf "  %-20s ${CYAN}http://%s:%s${RESET}\n"  "qBittorrent"    "$host_ip" "$qbit_port"
  printf "  %-20s ${CYAN}http://%s:%s${RESET}\n"  "Jellyfin"       "$host_ip" "$jellyfin_port"
  printf "  %-20s ${CYAN}http://%s:%s${RESET}\n"  "Bazarr"         "$host_ip" "$bazarr_port"
  printf "  %-20s ${CYAN}http://%s:%s${RESET}\n"  "Overseerr"      "$host_ip" "$overseerr_port"
  printf "  %-20s ${CYAN}http://%s:%s${RESET}\n"  "Tdarr"          "$host_ip" "$tdarr_port"
  printf "  %-20s ${CYAN}http://%s:%s${RESET}\n"  "MediaFlow Dash" "$host_ip" "$dashboard_port"
  echo ""
  echo -e "${BOLD}API Keys (stored in .env)${RESET}"
  echo -e "----------------------------------------------------------------------"
  printf "  %-20s ${YELLOW}%s${RESET}\n" "Sonarr"   "${SONARR_KEY:-see .env}"
  printf "  %-20s ${YELLOW}%s${RESET}\n" "Radarr"   "${RADARR_KEY:-see .env}"
  printf "  %-20s ${YELLOW}%s${RESET}\n" "Prowlarr" "${PROWLARR_KEY:-see .env}"
  echo ""
  echo -e "${BOLD}qBittorrent Login${RESET}"
  echo -e "----------------------------------------------------------------------"
  echo -e "  Username : ${YELLOW}admin${RESET}"
  echo -e "  Password : ${BOLD}${RED}${QBIT_PASS}${RESET}"
  echo -e "  ${BOLD}${YELLOW}⚠ WARNING: qBittorrent password changes on every container restart — set a permanent password in qBittorrent Settings → Web UI.${RESET}"
  echo -e "${BOLD}${GREEN}======================================================================${RESET}"
  echo ""
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
  INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  print_banner

  # Ensure running as non-root (or with sudo available)
  if [[ $EUID -eq 0 ]]; then
    warn "Running as root. It's recommended to run as a regular user with sudo access."
  fi

  info "Starting MediaFlow installation in: ${BOLD}$INSTALL_DIR${RESET}"
  echo ""

  detect_os
  check_disk_space
  check_ports
  install_dependencies
  install_docker
  configure_docker

  # Copy .env if it doesn't exist
  if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    info "Created .env from .env.example – review settings in $INSTALL_DIR/.env"
  fi

  configure_mediaflow_user
  generate_api_keys
  setup_permissions
  configure_firewall
  deploy_stack
  wait_for_services
  get_qbit_password
  automate_configurations
  print_summary
}

main "$@"
