#!/usr/bin/env bash
# =============================================================================
#  MediaFlow · install.sh
#  One-command installer for the full MediaFlow arr-stack + dashboard
# =============================================================================
export TERM="${TERM:-xterm-256color}"
set -euo pipefail

# Global error trap — always show which line failed
trap 'echo -e "\n[ERROR] Install failed at line $LINENO — command: $BASH_COMMAND" >&2; echo "[ERROR] Check ~/mediaflow/logs/install.log for details" >&2' ERR

# Test if ANSI escape codes crash the terminal
echo -e "\033[0m" >/dev/null 2>&1 || true

# ─── Non-Interactive Fallback & Colors ─────────────────────────────────────────
# Robust interactive detection — works correctly as root and via sudo
if [[ -t 1 && "${TERM:-}" != "dumb" && "${TERM:-}" != "" ]]; then
  INTERACTIVE=true
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  INTERACTIVE=false
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi

# ─── Basic Logging ───────────────────────────────────────────────────────────
timestamp() { date +"%Y-%m-%d %H:%M:%S"; }
LOG_FILE=""
safe_log() {
  [[ -n "$LOG_FILE" ]] && echo "$*" >> "$LOG_FILE" 2>/dev/null || true
}

log_to_file() { 
  safe_log "[$(timestamp)] $*"
}

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; log_to_file "[INFO] $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; log_to_file "[OK] $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; log_to_file "[WARN] $*"; }

error() {
  local msg="$*"
  echo -e "${RED}[ERROR]${RESET} $msg" >&2
  log_to_file "[ERROR] $msg"
  
  if $INTERACTIVE; then
    echo -e "${RED}╔══════════════════════════════════════════════════╗${RESET}"
    printf "${RED}║${RESET}  ${BOLD}✗ Installation failed at:${RESET} %-23s ${RED}║${RESET}\n" "${CURRENT_PHASE_NAME:-Unknown}"
    printf "${RED}║${RESET}  ${YELLOW}Error:${RESET} %-40s ${RED}║${RESET}\n" "${msg:0:40}"
    echo -e "${RED}║${RESET}  Run install.sh again or check logs/install.log  ${RED}║${RESET}"
    echo -e "${RED}╚══════════════════════════════════════════════════╝${RESET}"
  fi
}

die() { error "$*"; exit 1; }

# ─── Global Variable Defaults (prevent set -u crashes) ───────────────────────
OS=""
PKG_MANAGER=""
DOCKER_CMD="docker"
QBIT_PASS=""
SOURCE_KEY=""; SONARR_KEY=""; RADARR_KEY=""; PROWLARR_KEY=""; JWT_KEY=""; JELLYFIN_KEY=""
INSTALL_DIR=""

# ─── UI Helper Functions ─────────────────────────────────────────────────────
TOTAL_PHASES=7
CURRENT_PHASE=0
CURRENT_PHASE_NAME="Initialization"
INSTALL_START_TIME=$SECONDS

render_header() {
  CURRENT_PHASE_NAME="${1:-}"
  ((CURRENT_PHASE++)) || true
  log_to_file "[PHASE START] $CURRENT_PHASE/$TOTAL_PHASES: $CURRENT_PHASE_NAME"
  
  if ! $INTERACTIVE; then
    echo -e "\n=== Phase $CURRENT_PHASE: $CURRENT_PHASE_NAME ==="
    return
  fi
  
  local percent=$(( CURRENT_PHASE * 100 / TOTAL_PHASES ))
  local width=20
  local filled=$(( percent * width / 100 ))
  local empty=$(( width - filled ))
  local bar_color="${CYAN}"
  
  local bar=""
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=0; i<empty; i++)); do bar+="░"; done

  local phase_val="$CURRENT_PHASE_NAME ($CURRENT_PHASE of $TOTAL_PHASES)"
  local phase_prefix="     Current Phase: "
  
  local min_innen=54
  local req_innen=$(( ${#phase_prefix} + ${#phase_val} + 1 ))
  local innen=$min_innen
  if [[ $req_innen -gt $min_innen ]]; then
    innen=$req_innen
  fi

  local border=""
  for ((i=0; i<innen; i++)); do border+="═"; done

  local title_pad=$(( innen - 29 ))
  local title_spaces=""
  for ((i=0; i<title_pad; i++)); do title_spaces+=" "; done

  local prog_pad=$(( innen - 50 ))
  local prog_spaces=""
  for ((i=0; i<prog_pad; i++)); do prog_spaces+=" "; done

  local phase_pad=$(( innen - ${#phase_prefix} - ${#phase_val} ))
  local phase_spaces=""
  for ((i=0; i<phase_pad; i++)); do phase_spaces+=" "; done

  echo ""
  echo -e "${CYAN}╔${border}╗${RESET}"
  echo -e "${CYAN}║${RESET}     ${BOLD}MediaFlow Installer v1.4.0${RESET}${title_spaces}${CYAN}║${RESET}"
  printf "${CYAN}║${RESET}     Overall Progress: ${bar_color}[%-20s] %3d%%${RESET}${prog_spaces}${CYAN}║${RESET}\n" "$bar" "$percent"
  printf "${CYAN}║${RESET}${phase_prefix}%s${phase_spaces}${CYAN}║${RESET}\n" "$phase_val"
  echo -e "${CYAN}╚${border}╝${RESET}"
}

phase_complete() {
  local phase_name="${1:-}"
  local time_taken="${2:-0}"
  local mins=$(( time_taken / 60 ))
  local secs=$(( time_taken % 60 ))
  local time_str="${mins}m ${secs}s"
  [[ $mins -eq 0 ]] && time_str="${secs}s"
  
  if $INTERACTIVE; then
    echo -e "${GREEN}✔${RESET} Phase ${CURRENT_PHASE} complete: ${phase_name} (took ${time_str})"
  else
    echo "--- Phase ${CURRENT_PHASE} complete: ${phase_name} (took ${time_str}) ---"
  fi
  log_to_file "[PHASE COMPLETE] $CURRENT_PHASE_NAME in $time_str"
}

progress_bar() {
  local percent="${1:-0}"
  local label="${2:-}"
  local color="${3:-$CYAN}"
  
  if ! $INTERACTIVE; then
    [[ $percent -eq 100 || $((percent % 20)) -eq 0 ]] && echo "[$percent%] $label"
    return
  fi
  
  local width=20
  if [[ $percent -lt 0 ]]; then percent=0; fi
  if [[ $percent -gt 100 ]]; then percent=100; fi
  
  local filled=$(( percent * width / 100 ))
  local empty=$(( width - filled ))
  
  local bar=""
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=0; i<empty; i++)); do bar+="░"; done
  
  printf "\r${color}[%-20s] %3d%%${RESET} %s" "$bar" "$percent" "$label"
  if $INTERACTIVE; then command -v tput >/dev/null 2>&1 && tput el || true; fi
  [[ $percent -eq 100 ]] && echo ""
}

SPINNER_PID=""
start_spinner() {
  local msg="${1:-}"
  if ! $INTERACTIVE; then
    echo "Starting: $msg..."
    return
  fi
  
  if $INTERACTIVE; then command -v tput >/dev/null 2>&1 && tput civis || true; fi # Hide cursor
  
  (
    local chars="⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏"
    while true; do
      for c in $chars; do
        printf "\r${CYAN}%s${RESET} %s" "$c" "$msg"
        if $INTERACTIVE; then command -v tput >/dev/null 2>&1 && tput el || true; fi
        sleep 0.1
      done
    done
  ) &
  SPINNER_PID=$!
}

stop_spinner() {
  local end_msg="${1:-}"
  if [[ -n "$SPINNER_PID" ]] && kill -0 "$SPINNER_PID" 2>/dev/null; then
    kill "$SPINNER_PID" >/dev/null 2>&1 || true
    wait "$SPINNER_PID" 2>/dev/null || true
  fi
  SPINNER_PID=""
  
  if $INTERACTIVE; then
    command -v tput >/dev/null 2>&1 && tput cnorm || true # Show cursor
    printf "\r${GREEN}✔${RESET} %s" "$end_msg"
    command -v tput >/dev/null 2>&1 && tput el || true
    echo ""
  else
    echo "Done: $end_msg"
  fi
}

stop_spinner_fail() {
  local end_msg="${1:-}"
  if [[ -n "$SPINNER_PID" ]] && kill -0 "$SPINNER_PID" 2>/dev/null; then
    kill "$SPINNER_PID" >/dev/null 2>&1 || true
    wait "$SPINNER_PID" 2>/dev/null || true
  fi
  SPINNER_PID=""
  
  if $INTERACTIVE; then
    command -v tput >/dev/null 2>&1 && tput cnorm || true # Show cursor
    printf "\r${RED}✗${RESET} %s" "$end_msg"
    command -v tput >/dev/null 2>&1 && tput el || true
    echo ""
  else
    echo "Failed: $end_msg"
  fi
}

# ─── Banner ──────────────────────────────────────────────────────────────────
print_banner() {
  # Reset first to clear any lingering color codes
  echo -e "${RESET}"
  if $INTERACTIVE; then
    echo -e "${BOLD}${CYAN}"
  fi
  cat << 'EOF'
  ███╗   ███╗ ███████╗ ██████╗  ██╗  █████╗    ███████╗ ██╗       ██████╗  ██╗    ██╗
  ████╗ ████║ ██╔════╝ ██╔══██╗ ██║ ██╔══██╗   ██╔════╝ ██║      ██╔═══██╗ ██║    ██║
  ██╔████╔██║ █████╗   ██║  ██║ ██║ ███████║   █████╗   ██║      ██║   ██║ ██║ █╗ ██║
  ██║╚██╔╝██║ ██╔══╝   ██║  ██║ ██║ ██╔══██║   ██╔══╝   ██║      ██║   ██║ ██║███╗██║
  ██║ ╚═╝ ██║ ███████╗ ██████╔╝ ██║ ██║  ██║   ██║      ███████╗ ╚██████╔╝ ╚███╔███╔╝
  ╚═╝     ╚═╝ ╚══════╝ ╚═════╝  ╚═╝ ╚═╝  ╚═╝   ╚═╝      ╚══════╝  ╚═════╝   ╚══╝╚══╝
EOF
  echo -e "${RESET}"
  echo -e "  ${BOLD}Self-Hosted Media Automation Stack · v1.4.0${RESET}"
  echo -e "  Sonarr (x2) · Radarr · Prowlarr · qBittorrent · Jellyfin · Bazarr · Jellyseerr · Tdarr"
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
  if [[ $available_gb -lt $min_gb ]]; then
    warn "Insufficient disk space. Need at least ${min_gb}GB, have ${available_gb}GB."
    warn "Installation may fail during Docker operations, continuing anyway..."
  elif [[ $available_gb -lt $warn_gb ]]; then
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
      sudo apt-get update -qq 2>/dev/null || true
      sudo apt-get install -y -qq curl wget git ca-certificates gnupg lsb-release 2>/dev/null || true
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
        | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null || true
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
    sudo systemctl enable docker >/dev/null 2>&1 || true
    sudo systemctl start docker >/dev/null 2>&1 || true
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
      sudo ufw allow "$port/tcp" >/dev/null 2>&1 || true
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
  generate_key() { openssl rand -hex 32 || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 32 || true; }

  if grep -q "^SONARR_API_KEY=$" "$env_file" 2>/dev/null; then
    SONARR_KEY=$(generate_key)
    sed -i "s/^SONARR_API_KEY=.*/SONARR_API_KEY=$SONARR_KEY/" "$env_file" || true
  else
    SONARR_KEY=$(grep "^SONARR_API_KEY=" "$env_file" | cut -d= -f2 || true)
  fi

  if grep -q "^RADARR_API_KEY=$" "$env_file" 2>/dev/null; then
    RADARR_KEY=$(generate_key)
    sed -i "s/^RADARR_API_KEY=.*/RADARR_API_KEY=$RADARR_KEY/" "$env_file" || true
  else
    RADARR_KEY=$(grep "^RADARR_API_KEY=" "$env_file" | cut -d= -f2 || true)
  fi

  if grep -q "^PROWLARR_API_KEY=$" "$env_file" 2>/dev/null; then
    PROWLARR_KEY=$(generate_key)
    sed -i "s/^PROWLARR_API_KEY=.*/PROWLARR_API_KEY=$PROWLARR_KEY/" "$env_file" || true
  else
    PROWLARR_KEY=$(grep "^PROWLARR_API_KEY=" "$env_file" | cut -d= -f2 || true)
  fi

  if grep -q "^JWT_SECRET=$" "$env_file" 2>/dev/null; then
    JWT_KEY=$(generate_key)
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_KEY/" "$env_file" || true
  else
    JWT_KEY=$(grep "^JWT_SECRET=" "$env_file" | cut -d= -f2 || true)
  fi

  if grep -q "^JELLYFIN_API_KEY=$" "$env_file" 2>/dev/null; then
    JELLYFIN_KEY=$(generate_key)
    sed -i "s/^JELLYFIN_API_KEY=.*/JELLYFIN_API_KEY=$JELLYFIN_KEY/" "$env_file" || true
  else
    JELLYFIN_KEY=$(grep "^JELLYFIN_API_KEY=" "$env_file" | cut -d= -f2 || true)
  fi

  success "API keys and JWT secret generated"
}

# ─── Setup Permissions ───────────────────────────────────────────────────
setup_permissions() {
  render_header "Directory & Permissions Setup" || true
  info "Setting up complete TRaSH-compliant directory structure..."
  
  local dirs=(
    "$INSTALL_DIR/state"
    "$INSTALL_DIR/logs"
    "$INSTALL_DIR/data/media/movies"
    "$INSTALL_DIR/data/media/tv"
    "$INSTALL_DIR/data/media/anime"
    "$INSTALL_DIR/data/media/music"
    "$INSTALL_DIR/data/torrents/complete"
    "$INSTALL_DIR/data/torrents/incomplete"
    "$INSTALL_DIR/data/torrents/movies"
    "$INSTALL_DIR/data/torrents/tv"
    "$INSTALL_DIR/data/transcode_cache"
    "$INSTALL_DIR/appdata/radarr"
    "$INSTALL_DIR/appdata/sonarr"
    "$INSTALL_DIR/appdata/sonarr-anime"
    "$INSTALL_DIR/appdata/prowlarr"
    "$INSTALL_DIR/appdata/qbittorrent/qBittorrent"
    "$INSTALL_DIR/appdata/jellyfin"
    "$INSTALL_DIR/appdata/bazarr"
    "$INSTALL_DIR/appdata/jellyseerr"
    "$INSTALL_DIR/appdata/tdarr/server"
  )

  for dir in "${dirs[@]}"; do
    if sudo mkdir -p "$dir"; then
      if $INTERACTIVE; then
        echo -e "  ${GREEN}✔${RESET} Created: ${dir#$INSTALL_DIR/}"
      fi
    else
      echo -e "\n${RED}✗${RESET} Failed to create: $dir"
      die "Directory creation failed for $dir"
    fi
  done

  # Fix for root-owned logs directory preventing log_to_file calls inside this function
  sudo chown -R "${SUDO_USER:-$USER}" "$INSTALL_DIR/logs" 2>/dev/null || true

  # Avoid breaking if yt-downloads does not exist yet
  sudo mkdir -p "$INSTALL_DIR/data/yt-downloads"
  
  if [[ -f "$INSTALL_DIR/config/qBittorrent.conf" ]]; then
    sudo cp "$INSTALL_DIR/config/qBittorrent.conf" "$INSTALL_DIR/appdata/qbittorrent/qBittorrent/qBittorrent.conf"
  fi

  info "Applying ownership and permissions (775)..."

  # Read actual UID/GID from .env so it matches what containers run as
  local TARGET_UID; TARGET_UID=$(grep "^PUID=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "999")
  local TARGET_GID; TARGET_GID=$(grep "^PGID=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "987")
  info "Using UID=$TARGET_UID GID=$TARGET_GID from .env"

  local target_dirs=("$INSTALL_DIR/data" "$INSTALL_DIR/appdata" "$INSTALL_DIR/state")
  local total_targets=${#target_dirs[@]}
  local processed=0

  for dir in "${target_dirs[@]}"; do
    if [[ -d "$dir" ]]; then
      sudo chown -R "$TARGET_UID:$TARGET_GID" "$dir" || true
      sudo chmod -R 775 "$dir" || true
      ((processed++)) || true
      local p=$(( processed * 100 / total_targets ))
      progress_bar "$p" "Setting permissions on ${dir#$INSTALL_DIR/}" "${GREEN}" || true
    fi
  done
  echo ""

  # Explicitly apply permissions to sonarr-anime to prevent Permission Denied errors
  sudo chown -R "$TARGET_UID:$TARGET_GID" "$INSTALL_DIR/appdata/sonarr-anime" || true
  sudo chmod -R 775 "$INSTALL_DIR/appdata/sonarr-anime" || true
  
  success "Directories created and permissions configured."
  
  local t_taken=$(( SECONDS - INSTALL_START_TIME ))
  INSTALL_START_TIME=$SECONDS
  phase_complete "Directory & Permissions Setup" "$t_taken"
}

# ─── Pull Docker Images ──────────────────────────────────────────────────────
pull_images() {
  render_header "Pulling Docker images" || true
  info "Pulling images individually..."
  cd "$INSTALL_DIR"

  local compose_cmd="${DOCKER_CMD:-docker} compose"
  # Use docker compose config to get list of images
  local images=()
  while IFS= read -r line; do
    images+=("$line")
  done < <($compose_cmd config | grep "image:" | awk '{print $2}' | sort -u || true)
  
  local total=${#images[@]}
  if [[ $total -eq 0 ]]; then
    warn "No images found to pull."
  else
    local current=0
    for img in "${images[@]:-}"; do
      ((current++)) || true
      if ${DOCKER_CMD:-docker} image inspect "$img" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✔${RESET} Already present (cached): ${img##*/}"
        continue
      fi

      local img_name="${img##*/}"
      local size_msg=""
      case "$img_name" in
        *tdarr*) size_msg=" (~1.5GB — this may take several minutes)" ;;
        *jellyfin*) size_msg=" (~500MB)" ;;
        *sonarr*|*radarr*) size_msg=" (~300MB)" ;;
        *qbittorrent*) size_msg=" (~200MB)" ;;
        *bazarr*|*prowlarr*) size_msg=" (~150MB)" ;;
      esac

      local label="Pulling image $current of $total: $img_name$size_msg"

      if $INTERACTIVE; then
        echo -e "${CYAN}▶${RESET} ${BOLD}${label}${RESET}"
        
        START=$(date +%s)
        # Start heartbeat spinner subshell
        (
          start_time=$SECONDS
          local chars="⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏"
          local arr=($chars)
          local i=0
          while true; do
            elapsed=$(( SECONDS - start_time ))
            printf "\r\033[0;36m%s\033[0m Downloading %s... (%ds elapsed)\033[K" "${arr[$i]}" "$img_name" "$elapsed"
            i=$(( (i+1) % 10 ))
            sleep 1
          done
        ) &
        local heartbeat_pid=$!

        set +o pipefail
        # We pipe docker pull through awk
        ${DOCKER_CMD:-docker} pull "$img" 2>&1 | stdbuf -oL awk -v img_name="$img_name" '
          function to_mb(s) {
            val = s + 0
            if (s ~ /GB/) return val * 1024
            if (s ~ /kB/ || s ~ /KB/) return val / 1024
            if (s ~ /B/) return val / (1024 * 1024)
            return val
          }
          BEGIN { total_bytes=0; downloaded_bytes=0; }
          # Legacy layer counting for non-progress lines just in case
          /Pulling fs layer/ { layers++ }
          /Download complete/ || /Pull complete/ {
            done_layers++
          }
          
          # Catch byte download progress
          /Downloading/ {
             n = split($NF, arr, "/")
             if (n == 2) {
                layer = $1
                sub(/:/, "", layer)
                dl[layer] = to_mb(arr[1])
                tot[layer] = to_mb(arr[2])
                
                sum_dl = 0
                sum_tot = 0
                for (k in tot) {
                  sum_dl += dl[k]
                  sum_tot += tot[k]
                }
                if (sum_tot > 0) {
                  pct = int(sum_dl * 100 / sum_tot)
                  if (pct > 100) pct = 100
                  
                  filled = int(pct * 20 / 100)
                  empty = 20 - filled
                  bar = ""
                  for(i=0; i<filled; i++) bar = bar "█"
                  for(i=0; i<empty; i++) bar = bar "░"
                  
                  printf "\r\033[0;36m[%-20s] %3d%%\033[0m %s\033[K", bar, pct, "Pulling " img_name " (" int(sum_dl) "MB / " int(sum_tot) "MB)"
                }
             }
          }
        ' || {
          echo -e "\n${RED}✗${RESET} Failed to pull $img"
          warn "Docker pull failed for $img"
        } || true
        set -o pipefail
        
        # Kill heartbeat spinner
        kill $heartbeat_pid 2>/dev/null || true
        wait $heartbeat_pid 2>/dev/null || true
        
        ELAPSED=$(( $(date +%s) - START ))
        echo -e "\r\033[K\033[0;32m✔\033[0m Pulled $img_name successfully (${ELAPSED}s elapsed)"
      else
        echo "Pulling $img..."
        ${DOCKER_CMD:-docker} pull "$img" --quiet >/dev/null || die "Docker pull failed for $img"
      fi
    done
  fi

  info "Running catch-all compose pull..."
  stop_spinner >/dev/null 2>&1 || true
  echo -e "${CYAN}[INFO]${RESET}  Running catch-all compose pull..."
  
  ${compose_cmd} pull > /tmp/mediaflow_pull.log 2>&1
  local PULL_EXIT
  PULL_EXIT=$?
  if [[ $PULL_EXIT -eq 0 ]]; then
    success "All Docker images pulled."
  else
    error "Docker compose pull failed"
    cat /tmp/mediaflow_pull.log
    warn "compose pull failed, continuing..."
  fi
  local t_taken=$(( SECONDS - INSTALL_START_TIME ))
  INSTALL_START_TIME=$SECONDS
  phase_complete "Pulling Docker images" "$t_taken"
}

# ─── Build Docker Images ─────────────────────────────────────────────────────
build_images() {
  render_header "Building custom images" || true
  info "Building local Dockerfiles..."
  cd "$INSTALL_DIR"
  
  local compose_cmd="${DOCKER_CMD:-docker} compose"
  
  if $INTERACTIVE; then
    set +o pipefail
    ${compose_cmd} build --progress plain 2>&1 | stdbuf -oL awk '
      /Step ([0-9]+)\/([0-9]+)/ {
        match($0, /Step ([0-9]+)\/([0-9]+) : (.*)/, arr)
        if (arr[1] == "") {
           # new buildkit format
           match($0, /\[.* ([0-9]+)\/([0-9]+)\] (.*)/, arr)
        }
        if (arr[1] != "" && arr[2] != "") {
           step = int(arr[1])
           total = int(arr[2])
           desc = arr[3]
           pct = int(step * 100 / total)
           if (pct>100) pct=100
           
           filled = int(pct * 20 / 100)
           empty = 20 - filled
           bar = ""
           for(i=0; i<filled; i++) bar = bar "█"
           for(i=0; i<empty; i++) bar = bar "░"
           
           desc = substr(desc, 1, 40)
           printf "\r\033[0;36m[%-20s] %3d%%\033[0m %s\033[K", bar, pct, desc
        }
      }
      END {
        print ""
      }
    ' || warn "Build completed with some warnings/errors. Check logs." || true
    set -o pipefail
  else
    stop_spinner >/dev/null 2>&1 || true
    echo -e "${CYAN}[INFO]${RESET}  Building local Dockerfiles..."
    
    ${compose_cmd} build --quiet > /tmp/mediaflow_build.log 2>&1
    local BUILD_EXIT
    BUILD_EXIT=$?
    if [[ $BUILD_EXIT -ne 0 ]]; then
      error "Docker compose build completed with warnings/errors"
      cat /tmp/mediaflow_build.log
      warn "Continuing anyway..."
    fi
  fi
  
  success "Docker images built."
  
  local t_taken=$(( SECONDS - INSTALL_START_TIME ))
  INSTALL_START_TIME=$SECONDS
  phase_complete "Building custom images" "$t_taken"
}

# ─── Deploy Stack ────────────────────────────────────────────────────────────
deploy_stack() {
  render_header "Starting container stack" || true
  local data_path="$INSTALL_DIR/data"
  info "Verifying directory ownership and permissions before deploying..."
  
  if [[ ! -d "$data_path" ]]; then
      die "DATA_PATH $data_path does not exist! Please ensure it is created."
  fi

  local dir_owner=$(stat -c '%u' "$data_path" 2>/dev/null || stat -f '%u' "$data_path" 2>/dev/null || echo "unknown")
  local expected_uid; expected_uid=$(grep "^PUID=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "999")
  if [[ "$dir_owner" != "$expected_uid" ]]; then
      warn "DATA_PATH $data_path owner is $dir_owner, expected $expected_uid."
  fi
  
  info "Starting MediaFlow stack..."
  cd "$INSTALL_DIR"

  local compose_cmd="${DOCKER_CMD:-docker} compose"
  
  local SONARR_ANIME_ENABLED=$(grep "^SONARR_ANIME_ENABLED=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "true")
  local TDARR_ENABLED=$(grep "^TDARR_ENABLED=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "true")
  local BAZARR_ENABLED=$(grep "^BAZARR_ENABLED=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "true")

  # Define specific services to start based on toggles
  local core_services="radarr sonarr prowlarr qbittorrent jellyfin jellyseerr ytdlp backend frontend"
  [[ "$SONARR_ANIME_ENABLED" == "true" ]] && core_services+=" sonarr-anime"
  [[ "$TDARR_ENABLED" == "true" ]] && core_services+=" tdarr tdarr-node"
  [[ "$BAZARR_ENABLED" == "true" ]] && core_services+=" bazarr"
  
  stop_spinner >/dev/null 2>&1 || true
  echo "[INFO] Starting MediaFlow stack..."
  
  # Intentionally unquoted $core_services to allow word splitting of service names
  ${compose_cmd} up -d --remove-orphans $core_services > /tmp/mediaflow_deploy.log 2>&1
  local DEPLOY_EXIT
  DEPLOY_EXIT=$?
  
  if [[ $DEPLOY_EXIT -eq 0 ]]; then
    success "All containers started"
  else
    error "Docker compose up failed"
    cat /tmp/mediaflow_deploy.log
    die "Docker compose up failed (exit code $DEPLOY_EXIT)"
  fi

  info "Running post-start permission verification loop..."
  sleep 5
  
  local passed=()
  local failed=()
  for container in "mediaflow_radarr:/config" "mediaflow_radarr:/data" "mediaflow_sonarr:/config" "mediaflow_sonarr:/data" "mediaflow_sonarr-anime:/config" "mediaflow_sonarr-anime:/data" "mediaflow_prowlarr:/config" "mediaflow_qbittorrent:/config" "mediaflow_qbittorrent:/data" "mediaflow_jellyfin:/config" "mediaflow_bazarr:/config" "mediaflow_bazarr:/data" "mediaflow_jellyseerr:/app/config" "mediaflow_tdarr:/app/configs"; do
    local cname="${container%%:*}"
    local cpath="${container##*:}"
    if ${DOCKER_CMD:-docker} inspect "$cname" >/dev/null 2>&1; then
      if ${DOCKER_CMD:-docker} exec "$cname" sh -c "touch $cpath/.write_test && rm $cpath/.write_test" 2>/dev/null; then
         passed+=("$cname")
      else
         failed+=("$cname")
      fi
    fi
  done

  if [[ ${#failed[@]} -gt 0 ]]; then
    local failed_list
    failed_list=$(printf "%s\n" "${failed[@]}" | sort -u | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')
    echo -e "${RED}[ERROR] Permission denied on: ${failed_list}. Please run ./fix-permissions.sh.${RESET}"
    
    info "Attempting automatic fix with fix-permissions.sh..."
    bash "${INSTALL_DIR}/fix-permissions.sh" || true
    sleep 2
    
    failed=()
    for container in "mediaflow_radarr:/config" "mediaflow_radarr:/data" "mediaflow_sonarr:/config" "mediaflow_sonarr:/data" "mediaflow_sonarr-anime:/config" "mediaflow_sonarr-anime:/data" "mediaflow_prowlarr:/config" "mediaflow_qbittorrent:/config" "mediaflow_qbittorrent:/data" "mediaflow_jellyfin:/config" "mediaflow_bazarr:/config" "mediaflow_bazarr:/data" "mediaflow_jellyseerr:/app/config" "mediaflow_tdarr:/app/configs"; do
      local cname="${container%%:*}"
      local cpath="${container##*:}"
      if ${DOCKER_CMD:-docker} inspect "$cname" >/dev/null 2>&1; then
        if ! ${DOCKER_CMD:-docker} exec "$cname" sh -c "touch $cpath/.write_test && rm $cpath/.write_test" 2>/dev/null; then
           failed+=("$cname")
        fi
      fi
    done
    
    if [[ ${#failed[@]} -gt 0 ]]; then
      local failed_list2
      failed_list2=$(printf "%s\n" "${failed[@]}" | sort -u | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')
      echo -e "${BOLD}${RED}[ERROR] Verification still failed on: ${failed_list2}. Please fix manually.${RESET}"
    else
      echo -e "${GREEN}[OK] All containers have correct permissions${RESET}"
    fi
  else
    echo -e "${GREEN}[OK] All containers have correct permissions${RESET}"
  fi

  success "MediaFlow stack is running!"
  
  local t_taken=$(( SECONDS - INSTALL_START_TIME ))
  INSTALL_START_TIME=$SECONDS
  phase_complete "Starting container stack" "$t_taken"
}

# ─── Retrieve qBittorrent Temp Password ──────────────────────────────────────
get_qbit_password() {
  render_header "Passwords & Automation" || true
  start_spinner "Waiting for qBittorrent to initialize (approx 10s)..." || true
  sleep 10
  stop_spinner "qBittorrent initialized" || true
  
  start_spinner "Fetching qBittorrent temporary credentials..." || true
  local retries=20
  local compose_cmd="${DOCKER_CMD:-docker}"
  QBIT_PASS=""
  
  while [[ $retries -gt 0 ]]; do
    ((retries--)) || true
    # Primary: PCRE lookahead captures the password token directly
    QBIT_PASS=$(${compose_cmd} logs mediaflow_qbittorrent 2>&1 \
      | grep -oP "temporary password is provided for this session: \K\S+" \
      | tail -1 || true)
    
    # Fallback: match any line containing 'temporary password' and grab last colon-delimited token
    if [[ -z "$QBIT_PASS" ]]; then
      QBIT_PASS=$(${compose_cmd} logs mediaflow_qbittorrent 2>&1 \
        | grep -i "temporary password" \
        | grep -oP ':\s*\K\S+$' \
        | tail -1 || true)
    fi
    
    # Strip any potential leading/trailing whitespace
    QBIT_PASS=$(echo "$QBIT_PASS" | xargs 2>/dev/null || echo "$QBIT_PASS")
    
    if [[ -n "$QBIT_PASS" ]]; then
      break
    fi
    sleep 3
  done
  
  if [[ -z "$QBIT_PASS" ]]; then
    QBIT_PASS="Check: docker logs mediaflow_qbittorrent"
  fi
  stop_spinner "Captured credentials" || true
}

# ─── Wait for Services ───────────────────────────────────────────────────────
wait_for_services() {
  render_header "Health Checks" || true
  
  start_spinner "Waiting for containers to become healthy..." || true
  
  # Terminate the inner background spinner so it doesn't fight with our single-line printf
  if [[ -n "$SPINNER_PID" ]]; then
    kill "$SPINNER_PID" >/dev/null 2>&1 || true
    SPINNER_PID=""
  fi

  local containers=(
    "mediaflow_radarr" "mediaflow_sonarr" "mediaflow_qbittorrent"
    "mediaflow_jellyfin" "mediaflow_prowlarr" "mediaflow_bazarr"
    "mediaflow_jellyseerr" "mediaflow_tdarr" "mediaflow_sonarr-anime"
  )
  local total=${#containers[@]}
  local timeout=$(( SECONDS + 180 ))
  local last_print=0
  
  while [[ $SECONDS -lt $timeout ]]; do
    local ps_output
    ps_output=$(${DOCKER_CMD:-docker} ps --format '{{.Names}} {{.Status}}')
    local healthy=0
    
    for c in "${containers[@]}"; do
      if echo "$ps_output" | grep "^$c " | grep -q "[(]healthy[)]\|Up"; then
         if ! echo "$ps_output" | grep "^$c " | grep -q "[(]unhealthy[)]\|restarting"; then
           ((healthy++)) || true
         fi
      fi
    done
    
    if $INTERACTIVE; then
      printf "\r${CYAN}[INFO]${RESET}  Health checks: %d/%d containers healthy...\033[K" "$healthy" "$total"
    else
      if [[ $(( SECONDS - last_print )) -ge 15 ]]; then
        echo "Health checks: $healthy/$total containers healthy..."
        last_print=$SECONDS
      fi
    fi
    
    if [[ $healthy -ge $total ]]; then
      break
    fi
    sleep 5
  done
  
  if $INTERACTIVE; then echo ""; fi
  
  # Print Summary Table
  echo -e "Container Status Summary:"
  for c in "${containers[@]}"; do
    local health_status
    health_status=$(${DOCKER_CMD:-docker} inspect --format='{{.State.Health.Status}}' "$c" 2>/dev/null || echo "")
    local display_status
    if [[ "$health_status" == "healthy" ]]; then
      display_status="healthy"
    elif [[ -z "$health_status" || "$health_status" == "<no value>" ]]; then
      # No HEALTHCHECK defined — fall back to running status
      local run_status
      run_status=$(${DOCKER_CMD:-docker} inspect --format='{{.State.Status}}' "$c" 2>/dev/null || echo "")
      if [[ "$run_status" == "running" ]]; then
        display_status="running"
      else
        display_status="${run_status:-missing}"
      fi
    else
      display_status="$health_status"
    fi
    if [[ "$display_status" == "healthy" || "$display_status" == "running" ]]; then
      printf "  %-25s ${GREEN}✔ Healthy${RESET}\n" "$c"
    else
      printf "  %-25s ${RED}✗ Unhealthy (%s)${RESET}\n" "$c" "$display_status"
    fi
  done
  echo ""

  local t_taken=$(( SECONDS - INSTALL_START_TIME ))
  INSTALL_START_TIME=$SECONDS
  phase_complete "Health Checks" "$t_taken"
}

# ─── Automate Configurations ─────────────────────────────────────────────────
automate_configurations() {
  start_spinner "Automating advanced API configurations..." || true
  sleep 10
  
  local SONARR_KEY=$(grep "^SONARR_API_KEY=" "$INSTALL_DIR/.env" | cut -d= -f2 || true)
  local PROWLARR_KEY=$(grep "^PROWLARR_API_KEY=" "$INSTALL_DIR/.env" | cut -d= -f2 || true)
  
  curl -s -X POST "http://localhost:9696/api/v1/applications" \
    -H "Content-Type: application/json" -H "X-Api-Key: ${PROWLARR_KEY}" \
    -d '{ "name": "Sonarr-Anime", "implementation": "Sonarr", "configContract": "SonarrSettings", "fields": [ { "name": "prowlarrUrl", "value": "http://prowlarr:9696" }, { "name": "baseUrl", "value": "http://sonarr-anime:8989" }, { "name": "apiKey", "value": "'"${SONARR_KEY}"'" }, { "name": "syncLevel", "value": "fullSync" } ], "appProfileId": 1 }' >/dev/null || true
  
  stop_spinner "Advanced API configurations applied" || true
  
  local t_taken=$(( SECONDS - INSTALL_START_TIME ))
  INSTALL_START_TIME=$SECONDS
  phase_complete "Passwords & Automation" "$t_taken"
}

# ─── Print Summary ───────────────────────────────────────────────────────────
print_summary() {
  local host_ip
  host_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

  local dashboard_port=$(grep "^DASHBOARD_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8080")
  local sonarr_port=$(grep "^SONARR_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8989")
  local radarr_port=$(grep "^RADARR_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "7878")
  local prowlarr_port=$(grep "^PROWLARR_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "9696")
  local qbit_port=$(grep "^QBIT_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8082")
  local jellyfin_port=$(grep "^JELLYFIN_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8096")
  
  local bazarr_port=$(grep "^BAZARR_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "6767")
  local sonarr_anime_port=$(grep "^SONARR_ANIME_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8990")
  local jellyseerr_port=$(grep "^JELLYSEERR_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "5055")
  local tdarr_port=$(grep "^TDARR_UI_PORT=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "8265")

  local total_mins=$(( SECONDS / 60 ))
  local total_secs=$(( SECONDS % 60 ))

  # Width-measurement lines use ASCII-only substitutions so ${#line} is
  # terminal-display-accurate (emojis are 2 display cols but counted as
  # multiple bytes by bash; we measure with safe ASCII stand-ins here).
  local measure_lines=(
    "  [OK] MediaFlow v1.4.0 installed successfully!"
    "  [T]  Total time: $total_mins minutes $total_secs seconds"
    "  Dashboard      ->  http://$host_ip:$dashboard_port"
    "  Radarr         ->  http://$host_ip:$radarr_port"
    "  Sonarr         ->  http://$host_ip:$sonarr_port"
    "  Sonarr Anime   ->  http://$host_ip:$sonarr_anime_port"
    "  Prowlarr       ->  http://$host_ip:$prowlarr_port"
    "  qBittorrent    ->  http://$host_ip:$qbit_port"
    "  Jellyfin       ->  http://$host_ip:$jellyfin_port"
    "  Bazarr         ->  http://$host_ip:$bazarr_port"
    "  Jellyseerr     ->  http://$host_ip:$jellyseerr_port"
    "  Tdarr          ->  http://$host_ip:$tdarr_port"
    "  YouTube        ->  ./data/yt-downloads"
    "  qBittorrent credentials:"
    "  Username: admin"
    "  Password: ${QBIT_PASS:0:42}"
    "  [!] Change default passwords after first login"
  )
  # raw_lines holds the actual display text (with emojis) at matching indices
  local raw_lines=(
    "  🎉  MediaFlow v1.4.0 installed successfully!"
    "  ⏱  Total time: $total_mins minutes $total_secs seconds"
    "  Dashboard      →  http://$host_ip:$dashboard_port"
    "  Radarr         →  http://$host_ip:$radarr_port"
    "  Sonarr         →  http://$host_ip:$sonarr_port"
    "  Sonarr Anime   →  http://$host_ip:$sonarr_anime_port"
    "  Prowlarr       →  http://$host_ip:$prowlarr_port"
    "  qBittorrent    →  http://$host_ip:$qbit_port"
    "  Jellyfin       →  http://$host_ip:$jellyfin_port"
    "  Bazarr         →  http://$host_ip:$bazarr_port"
    "  Jellyseerr     →  http://$host_ip:$jellyseerr_port"
    "  Tdarr          →  http://$host_ip:$tdarr_port"
    "  YouTube        →  ./data/yt-downloads"
    "  qBittorrent credentials:"
    "  Username: admin"
    "  Password: ${QBIT_PASS:0:42}"
    "  ⚠  Change default passwords after first login"
  )

  local max_len=0
  for line in "${measure_lines[@]}"; do
    local len=${#line}
    if [[ $len -gt $max_len ]]; then
      max_len=$len
    fi
  done

  local box_width=$((max_len + 4))
  
  local top_border=""
  local div_border=""
  local bot_border=""
  for ((i=0; i<box_width; i++)); do
    top_border+="═"
    div_border+="═"
    bot_border+="═"
  done

  # helper to print line
  print_line() {
    local raw_text="$1"
    local ansi_text="$2"
    local pad_len=$(( box_width - 4 - ${#raw_text} ))
    local pad=""
    if [[ $pad_len -gt 0 ]]; then
      for ((i=0; i<pad_len; i++)); do pad+=" "; done
    fi
    echo -e "${GREEN}║${RESET}  ${ansi_text}${pad}  ${GREEN}║${RESET}"
  }

  echo ""
  echo -e "${GREEN}╔${top_border}╗${RESET}"
  print_line "${measure_lines[0]}" "🎉  ${BOLD}MediaFlow v1.4.0 installed successfully!${RESET}"
  print_line "${measure_lines[1]}" "⏱  Total time: $total_mins minutes $total_secs seconds"
  echo -e "${GREEN}╠${div_border}╣${RESET}"
  print_line "${measure_lines[2]}" "Dashboard      →  ${CYAN}http://$host_ip:$dashboard_port${RESET}"
  print_line "${measure_lines[3]}" "Radarr         →  ${CYAN}http://$host_ip:$radarr_port${RESET}"
  print_line "${measure_lines[4]}" "Sonarr         →  ${CYAN}http://$host_ip:$sonarr_port${RESET}"
  print_line "${measure_lines[5]}" "Sonarr Anime   →  ${CYAN}http://$host_ip:$sonarr_anime_port${RESET}"
  print_line "${measure_lines[6]}" "Prowlarr       →  ${CYAN}http://$host_ip:$prowlarr_port${RESET}"
  print_line "${measure_lines[7]}" "qBittorrent    →  ${CYAN}http://$host_ip:$qbit_port${RESET}"
  print_line "${measure_lines[8]}" "Jellyfin       →  ${CYAN}http://$host_ip:$jellyfin_port${RESET}"
  print_line "${measure_lines[9]}" "Bazarr         →  ${CYAN}http://$host_ip:$bazarr_port${RESET}"
  print_line "${measure_lines[10]}" "Jellyseerr     →  ${CYAN}http://$host_ip:$jellyseerr_port${RESET}"
  print_line "${measure_lines[11]}" "Tdarr          →  ${CYAN}http://$host_ip:$tdarr_port${RESET}"
  print_line "${measure_lines[12]}" "YouTube        →  ${CYAN}./data/yt-downloads${RESET}"
  echo -e "${GREEN}╠${div_border}╣${RESET}"
  print_line "${measure_lines[13]}" "${BOLD}qBittorrent credentials:${RESET}"
  print_line "${measure_lines[14]}" "Username: ${YELLOW}admin${RESET}"
  print_line "${measure_lines[15]}" "Password: ${RED}${QBIT_PASS:0:42}${RESET}"
  echo -e "${GREEN}╠${div_border}╣${RESET}"
  print_line "${measure_lines[16]}" "${YELLOW}⚠  Change default passwords after first login${RESET}"
  echo -e "${GREEN}╚${bot_border}╝${RESET}"
  echo ""
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
  INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  LOG_FILE="$INSTALL_DIR/logs/install.log"
  
  if [[ -d "${INSTALL_DIR}/logs" ]] && [[ ! -w "${INSTALL_DIR}/logs" ]]; then
    sudo chown -R "$(whoami):$(whoami)" "${INSTALL_DIR}/logs" 2>/dev/null || true
  fi
  mkdir -p "$INSTALL_DIR/logs"
  touch "$LOG_FILE" 2>/dev/null || true
  chown "$(whoami)" "$LOG_FILE" 2>/dev/null || true
  chmod 664 "$LOG_FILE" 2>/dev/null || true

  if $INTERACTIVE; then clear; fi
  print_banner || true

  if [[ $EUID -eq 0 ]]; then
    warn "Running as root. It's recommended to run as a regular user with sudo access (sudo -E bash install.sh)."
  fi

  info "Starting MediaFlow installation in: ${BOLD}$INSTALL_DIR${RESET}"
  echo ""
  
  TOTAL_PHASES=7
  INSTALL_START_TIME=$SECONDS

  render_header "System Setup" || true
  detect_os
  check_disk_space
  check_ports

  echo "[INFO]  Installing system dependencies..."
  set +e
  install_dependencies > /tmp/mediaflow_deps.log 2>&1
  DEPS_EXIT=$?
  set -e
  if [[ $DEPS_EXIT -eq 0 ]]; then
    success "Dependencies installed"
  else
    error "Failed to install dependencies"
    cat /tmp/mediaflow_deps.log
    die "Dependencies installation failed (exit code $DEPS_EXIT)"
  fi

  install_docker
  configure_docker

  if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    info "Created .env from .env.example"
  fi

  configure_mediaflow_user
  generate_api_keys
  configure_firewall

  local t_taken=$(( SECONDS - INSTALL_START_TIME ))
  INSTALL_START_TIME=$SECONDS
  phase_complete "System Setup" "$t_taken"

  setup_permissions
  pull_images
  build_images
  deploy_stack
  wait_for_services
  get_qbit_password
  automate_configurations
  print_summary
}

_SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
mkdir -p "$_SCRIPT_DIR/logs"
touch "$_SCRIPT_DIR/logs/install.log" 2>/dev/null || true
chown "$(whoami)" "$_SCRIPT_DIR/logs/install.log" 2>/dev/null || true
chmod 664 "$_SCRIPT_DIR/logs/install.log" 2>/dev/null || true
set +o pipefail
main "$@" 2>&1 | tee -a "$_SCRIPT_DIR/logs/install.log" || true
