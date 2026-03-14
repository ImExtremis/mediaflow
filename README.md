# MediaFlow — Self-Hosted Media Automation Stack

<div align="center">

```
  ███╗   ███╗ ███████╗ ██████╗  ██╗  █████╗    ███████╗ ██╗       ██████╗  ██╗    ██╗
  ████╗ ████║ ██╔════╝ ██╔══██╗ ██║ ██╔══██╗   ██╔════╝ ██║      ██╔═══██╗ ██║    ██║
  ██╔████╔██║ █████╗   ██║  ██║ ██║ ███████║   █████╗   ██║      ██║   ██║ ██║ █╗ ██║
  ██║╚██╔╝██║ ██╔══╝   ██║  ██║ ██║ ██╔══██║   ██╔══╝   ██║      ██║   ██║ ██║███╗██║
  ██║ ╚═╝ ██║ ███████╗ ██████╔╝ ██║ ██║  ██║   ██║      ███████╗ ╚██████╔╝ ╚███╔███╔╝
  ╚═╝     ╚═╝ ╚══════╝ ╚═════╝  ╚═╝ ╚═╝  ╚═╝   ╚═╝      ╚══════╝  ╚═════╝   ╚══╝╚══╝
```

**Self-Hosted Media Automation Stack**

[![Version](https://img.shields.io/badge/version-1.4.5-blue.svg)](https://github.com/ImExtremis/media-flow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-required-blue.svg)](https://www.docker.com/)

</div>

---

## Table of Contents

1. [Introduction](#introduction)
2. [Features](#features)
3. [Requirements](#requirements)
4. [Installation](#installation)
5. [Post-Install Configuration](#post-install-configuration)
6. [Dashboard Walkthrough](#dashboard-walkthrough)
7. [Updating MediaFlow](#updating-mediaflow)
8. [Backup & Recovery](#backup--recovery)
9. [Default Credentials](#default-credentials)
10. [External Access & Tailscale](#external-access--tailscale)
11. [Tdarr Transcoding Guide](#tdarr-transcoding-guide)
12. [Troubleshooting](#troubleshooting)
13. [Planned Features](#planned-features)
14. [Changelog](#changelog)
15. [License & Credits](#license--credits)

---

## Introduction

MediaFlow is a fully self-hosted, Docker-based media automation stack built for people who want complete control over their media library — no subscriptions, no cloud dependency, no data leaving your home.

It combines the best open-source tools in the media automation ecosystem into a single, cohesive system managed through a custom React dashboard. You request a movie or TV show, MediaFlow finds it, downloads it, organises it, transcodes it if needed, fetches subtitles, and makes it available to stream — all automatically.

**Why MediaFlow?**

- **No subscriptions.** No Netflix, no Plex Pass, no monthly fees. You own your media.
- **Full control.** Every setting, every quality profile, every language preference is yours to configure.
- **Self-hosted.** Everything runs on your own hardware. Your data never leaves your network.
- **Unified dashboard.** One interface to monitor, manage, and control your entire stack.
- **Built for India.** Hindi/English multi-audio for movies, Japanese/English for anime, Indian streaming region support.

---

## Features

### Core Stack
| Service | Purpose |
|---|---|
| **Radarr** | Automated movie downloading and library management |
| **Sonarr** | Automated TV show downloading and library management |
| **Sonarr-Anime** | Dedicated anime instance with Japanese audio + English subtitles |
| **Prowlarr** | Centralised indexer management — connects to all arr apps |
| **qBittorrent** | Torrent client with web UI |
| **Jellyfin** | Free, open-source media server — stream anywhere |
| **Bazarr** | Automatic subtitle downloading for all your media |
| **Jellyseerr** | Request portal — one place to request movies and shows |
| **Tdarr** | Automated transcoding to save disk space |
| **yt-dlp** | YouTube video downloader integrated into the dashboard |

### Dashboard Features
- Live health monitoring for all services
- Per-service quick links with status badges
- Processing queue display (Sonarr, Radarr, Sonarr-Anime)
- Disk space usage with visual indicator
- Download speed and active torrent stats
- Trending content browser with per-platform filtering
- YouTube downloader with inline video preview
- User management with role-based access (Admin, Requester, Viewer)
- JWT authentication with setup wizard
- System update manager with automatic rollback
- Prowlarr indexer management
- Quality profile configuration
- Language preference settings
- Speed limit controls for qBittorrent
- Storage path configuration
- Mobile-responsive sidebar

---

## Requirements

### Minimum Hardware
| Component | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8 GB |
| Storage (System) | 20 GB | 50 GB |
| Storage (Media) | 500 GB | 2 TB+ |
| Network | 10 Mbps | 50 Mbps+ |

> **Note:** Storage for media should ideally be on a separate drive from the system. Use `DATA_PATH` in `.env` to point to your media drive.

### Operating System
- Ubuntu 20.04 LTS or newer (recommended)
- Debian 11 or newer
- Any Debian-based Linux distribution

### Software Dependencies
The install script handles all of these automatically:
- Docker Engine 24+
- Docker Compose v2+
- curl, wget, git

### Required Ports
Ensure these ports are free before installing:

| Port | Service |
|---|---|
| 8080 | MediaFlow Dashboard |
| 3001 | Backend API (internal) |
| 7878 | Radarr |
| 8989 | Sonarr |
| 8990 | Sonarr-Anime |
| 9696 | Prowlarr |
| 8082 | qBittorrent |
| 8096 | Jellyfin |
| 6767 | Bazarr |
| 5055 | Jellyseerr |
| 8265 | Tdarr |

---

## Installation

### Step 1 — Clone the Repository

```bash
git clone https://github.com/ImExtremis/media-flow.git ~/mediaflow
cd ~/mediaflow
```

### Step 2 — Configure Environment

Copy the example environment file and edit it:

```bash
cp .env.example .env
nano .env
```

Key variables to set:

```env
# Your server's LAN IP address
SERVER_IP=192.168.1.100

# Path where media will be stored (can be an external drive)
DATA_PATH=/home/yourusername/mediaflow/data

# API Keys (fill these in after setting up the services)
SONARR_API_KEY=
RADARR_API_KEY=
PROWLARR_API_KEY=
JELLYFIN_API_KEY=
OMDB_API_KEY=         # Free at omdbapi.com — for trending page

# GitHub repo for update checks
GITHUB_REPO=ImExtremis/media-flow
```

> **Tip:** You can leave the API keys blank for now. The install script will start all services and you can fill them in after first boot.

### Step 3 — Run the Installer

```bash
bash install.sh
```

The installer runs through 7 phases:

| Phase | What Happens |
|---|---|
| 1. System Setup | Detects OS, checks ports, installs dependencies, installs Docker |
| 2. Directory & Permissions | Creates all data directories, sets correct ownership |
| 3. Pulling Docker Images | Downloads all service images (~3–5 GB total) |
| 4. Building Custom Images | Builds the React dashboard and Node.js backend |
| 5. Starting Container Stack | Starts all 13 containers |
| 6. Health Checks | Waits for all services to become healthy |
| 7. Passwords & Automation | Captures qBittorrent password, applies API configurations |

**Expected install time:** 5–15 minutes depending on your internet speed.

### Step 4 — Access the Dashboard

Once installation completes, open your browser and go to:

```
http://YOUR_SERVER_IP:8080
```

You will be greeted by the setup wizard to create your admin account.

---

## Post-Install Configuration

After the installer completes, you need to configure each service. Do this in order.

### 1. Prowlarr — Add Indexers

Prowlarr is the central indexer manager. It connects to Sonarr and Radarr so you only need to add indexers once.

1. Go to `http://YOUR_IP:9696`
2. Navigate to **Indexers → Add Indexer**
3. Recommended indexers to add:
   - **1337x** — general movies and TV
   - **YTS** — high quality movies
   - **Nyaa** — anime (essential for Sonarr-Anime)
   - **TorrentGalaxy** — general content
4. After adding indexers, navigate to **Settings → Apps**
5. Add Radarr, Sonarr, and Sonarr-Anime as apps using their API keys
6. Click **Sync App Indexers** to push all indexers to the arr apps

**Getting API Keys:**
- Radarr: `http://YOUR_IP:7878` → Settings → General → API Key
- Sonarr: `http://YOUR_IP:8989` → Settings → General → API Key
- Sonarr-Anime: `http://YOUR_IP:8990` → Settings → General → API Key
- Prowlarr: `http://YOUR_IP:9696` → Settings → General → API Key

Save all of these to your `.env` file.

### 2. Radarr — Configure Movies

1. Go to `http://YOUR_IP:7878`
2. **Settings → Media Management → Root Folders** → Add `/data/media/movies`
3. **Settings → Profiles** → Configure your preferred quality profile (1080p recommended)
4. **Settings → Download Clients** → Add qBittorrent:
   - Host: `qbittorrent`
   - Port: `8080`
   - Username: `admin`
   - Password: your qBittorrent password

### 3. Sonarr — Configure TV Shows

1. Go to `http://YOUR_IP:8989`
2. **Settings → Media Management → Root Folders** → Add `/data/media/tv`
3. **Settings → Profiles** → Configure quality profile
4. **Settings → Download Clients** → Add qBittorrent (same as Radarr)

### 4. Sonarr-Anime — Configure Anime

1. Go to `http://YOUR_IP:8990`
2. **Settings → Media Management → Root Folders** → Add `/data/media/anime`
3. **Settings → Profiles** → Set a profile that prioritises dual-audio or Japanese audio
4. **Settings → Download Clients** → Add qBittorrent (same as above)

> **Why a separate Sonarr for Anime?** Anime torrents are best sourced from Nyaa, which is an anime-specific indexer. Having a dedicated instance lets you set Japanese + English subtitle preferences as the default without affecting regular TV shows. It also keeps your library clean — anime in `/data/media/anime`, TV in `/data/media/tv`.

### 5. qBittorrent — Configure Paths

1. Go to `http://YOUR_IP:8082`
2. **Tools → Options → Downloads**
3. Set **Default Save Path** to `/data/torrents/complete`
4. Enable **Create subfolder for multi-file torrents**
5. **Tools → Options → WebUI** — change the default password to something permanent (important — see [Default Credentials](#default-credentials))

### 6. Jellyfin — Set Up Libraries

1. Go to `http://YOUR_IP:8096`
2. Complete the initial setup wizard
3. Add media libraries:
   - **Movies** → `/data/media/movies`
   - **TV Shows** → `/data/media/tv`
   - **Anime** → `/data/media/anime`
   - **YouTube** → `/data/media/youtube`
4. Go to **Dashboard → API Keys** and generate an API key
5. Save it to your `.env` as `JELLYFIN_API_KEY=`

### 7. Jellyseerr — Connect to Jellyfin

1. Go to `http://YOUR_IP:5055`
2. Click **Sign in with Jellyfin**
3. Jellyfin URL: `http://jellyfin:8096` (internal Docker hostname)
4. Enter your Jellyfin admin credentials
5. **Configure Radarr:**
   - Hostname: `radarr`
   - Port: `7878`
   - API Key: from Radarr settings
   - Root Folder: `/data/media/movies`
6. **Configure Sonarr:**
   - Hostname: `sonarr`
   - Port: `8989`
   - API Key: from Sonarr settings
   - Root Folder: `/data/media/tv`
7. For anime requests, add a second Sonarr instance pointing to Sonarr-Anime on port `8990`

### 8. Bazarr — Configure Subtitles

1. Go to `http://YOUR_IP:6767`
2. **Settings → Sonarr** → connect with API key, set host to `sonarr`, port `8989`
3. **Settings → Radarr** → connect with API key, set host to `radarr`, port `7878`
4. **Settings → Providers** → Add OpenSubtitles.com (free account required at opensubtitles.com)
5. **Settings → Languages** → Set preferred subtitle languages (English, Hindi as needed)

### 9. Restart Backend with New API Keys

After saving all API keys to `.env`, restart the backend to pick them up:

```bash
cd ~/mediaflow
docker compose restart backend
```

---

## Dashboard Walkthrough

### Health Monitor (Home)
The main dashboard shows a live overview of your entire stack. It displays disk usage on `/data`, current download and upload speeds from qBittorrent, processing queues for Sonarr/Radarr, and a grid of all services with their health status. Each service card has an **Open** button that links directly to that service's web UI.

### Trending
Browse trending movies and TV shows. Switch between **All Trending** and **By Platform** to see what's trending on Netflix, Amazon Prime, Disney+ Hotstar, and Apple TV+. Click **+ Add** on any item to send it directly to Radarr or Sonarr for downloading. Requires an OMDB API key in `.env`.

### Requests (Jellyseerr)
An embedded Jellyseerr interface for requesting new media. Search for any movie or show and submit a request — Jellyseerr will automatically send it to the appropriate Sonarr or Radarr instance.

### Watch (Jellyfin)
An embedded Jellyfin player. Browse and stream your entire library directly from the MediaFlow dashboard without leaving the page.

### YouTube
Download any YouTube video or playlist using the integrated yt-dlp container. Select your preferred quality (Best, 1080p, 720p, Audio Only) and click Start Download. Downloaded files appear in the file list below with an inline video preview player. Files are saved to `/data/yt-downloads` and also available in Jellyfin under the YouTube library.

### Indexers
Manage your Prowlarr indexers without leaving the dashboard. Enable or disable individual indexers, trigger a full sync to push indexers to all arr apps, and link directly to Prowlarr for advanced configuration.

### Settings
Manage system updates, update channel (Stable/Beta), quality profiles, language preferences, speed limits, storage paths, and content rating filters.

### Users
Admin-only. Add, edit, or remove dashboard users. Three roles are available:
- **Admin** — full access to all features
- **Requester** — can browse trending and submit requests
- **Viewer** — read-only access to health monitor and watch page

---

## Updating MediaFlow

MediaFlow uses a two-stage update system designed to be safe and self-healing.

### How It Works

1. `update.sh` (the launcher) — authenticates, runs `git pull`, then hands off
2. `scripts/do-update.sh` (the worker) — does the actual update work

This design means `update.sh` itself almost never changes, while `do-update.sh` can be freely updated with each release.

### Running an Update

```bash
cd ~/mediaflow
bash update.sh
```

You will be prompted for your update password (set during initial setup). The update process:

1. Pre-flight checks
2. Creates a full backup
3. Enables maintenance mode
4. Pulls latest code from GitHub
5. Shows a diff of what changed
6. Builds new frontend and backend Docker images
7. Pulls latest images for all services
8. Restarts the stack
9. Verifies all containers are healthy

### Automatic Rollback

If anything fails during the update, MediaFlow automatically rolls back to the previous version. The backup created at the start of the update is used to restore all files, and the stack is restarted from the previous state.

### Update Channels

- **Stable** — only installs tagged releases (recommended)
- **Beta** — tracks the main branch, may be unstable

Change the channel in **Settings → System Updates**.

---

## Backup & Recovery

### What Gets Backed Up

The `backup.sh` script creates a compressed archive of:
- All `appdata/` directories (service configurations)
- The `.env` file
- `config/` directory (dashboard users, settings)
- `docker-compose.yml`
- `VERSION` file

Media files (`data/media/`) and downloads (`data/torrents/`) are **not** backed up by default as they are too large. Only configuration is backed up.

### Running a Manual Backup

```bash
cd ~/mediaflow
bash backup.sh
```

Backups are saved to `~/mediaflow/backups/` as `mediaflow_backup_YYYYMMDD_HHMMSS.tar.gz`.

### Recommended Backup Schedule

Add this to your crontab (`crontab -e`) to run automatic daily backups:

```bash
# Run MediaFlow backup every day at 2 AM
0 2 * * * cd /home/yourusername/mediaflow && bash backup.sh >> logs/backup.log 2>&1
```

### Restoring from Backup

```bash
cd ~/mediaflow

# Stop the stack
docker compose down

# Extract the backup
tar -xzf backups/mediaflow_backup_YYYYMMDD_HHMMSS.tar.gz -C ~/mediaflow

# Restart
docker compose up -d
```

---

## Default Credentials

### MediaFlow Dashboard
Set during the setup wizard on first launch. No default — you create your own admin account.

### qBittorrent
| Field | Value |
|---|---|
| Username | `admin` |
| Password | Auto-generated temporary password on first run |

**Important:** qBittorrent generates a new temporary password every time it starts if no permanent password has been set. You must set a permanent password in qBittorrent's settings (**Tools → Options → WebUI → Password**) immediately after first login.

**Recovering the qBittorrent password if you lost it:**

```bash
docker logs mediaflow_qbittorrent 2>&1 | grep -i "temporary password" | tail -1
```

This retrieves the current session password from the container logs.

### Jellyfin
Set during Jellyfin's own setup wizard at `http://YOUR_IP:8096`. No default.

### Radarr / Sonarr / Prowlarr / Bazarr
No authentication by default. It is strongly recommended to enable authentication in each service's settings if your server is accessible outside your home network.

---

## External Access & Tailscale

### Option 1 — Tailscale (Recommended, Easiest)

Tailscale creates an encrypted WireGuard mesh between your devices. No port forwarding, no static IP required.

**Install on your MediaFlow server:**

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Authenticate via the URL shown. Your server will get a Tailscale IP like `100.x.x.x`. You can now access MediaFlow from anywhere at `http://100.x.x.x:8080`.

**Install on your phone/laptop:**
Download the Tailscale app, sign in with the same account, and all your devices are connected.

### Option 2 — Nginx Reverse Proxy with Domain

If you have a domain name and want clean URLs like `media.yourdomain.com`:

**Install Nginx:**
```bash
sudo apt install nginx certbot python3-certbot-nginx
```

**Create a site config `/etc/nginx/sites-available/mediaflow`:**
```nginx
server {
    server_name media.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable and get SSL certificate:**
```bash
sudo ln -s /etc/nginx/sites-available/mediaflow /etc/nginx/sites-enabled/
sudo certbot --nginx -d media.yourdomain.com
sudo systemctl reload nginx
```

### CCTV Streaming via Tailscale

If you want to stream a CCTV camera from another location (e.g. a shop) into Jellyfin at home:

**At the remote location, set up a Raspberry Pi:**
```bash
# Install Tailscale on the RPi
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

The RPi joins the same Tailscale network as your MediaFlow server. Your MediaFlow server can now reach the CCTV camera through the RPi's Tailscale IP.

**Add the camera stream to Jellyfin:**

Create a file `~/mediaflow/data/media/cctv.m3u`:
```m3u
#EXTM3U
#EXTINF:-1,Front Camera
rtsp://admin:password@100.x.x.x:554/stream
```

In Jellyfin → Dashboard → Live TV → Add Tuner → M3U Tuner → point to the `.m3u` file.

---

## Tdarr Transcoding Guide

Tdarr automatically transcodes your media to save disk space and ensure compatibility. Access it at `http://YOUR_IP:8265`.

### What Tdarr Does

Tdarr watches your media libraries and transcodes files that don't meet your configured profile — for example, converting large MKV files to H.265 to reduce file size by 40–60%, or removing unwanted audio tracks.

### CPU Transcoding (Any Hardware)

CPU transcoding works on any machine but is slow and CPU-intensive. A typical 1080p movie takes 20–60 minutes to transcode.

**Recommended Tdarr plugin stack for CPU:**
1. **Reorder Streams** — puts video first, then audio, then subtitles
2. **Remove Closed Captions** — cleans up unnecessary streams
3. **H.265 transcode using FFmpeg** — converts H.264 → H.265 for ~50% size reduction
4. **Set audio to AAC** — ensures broad compatibility

**In Tdarr settings:**
- Transcode GPU count: `0`
- Transcode CPU workers: `1` or `2` (do not max out or your server becomes unresponsive)

### GPU Transcoding — Intel Quick Sync (iGPU)

If your server has an Intel CPU with integrated graphics (Sandy Bridge or newer), you can use Intel Quick Sync for hardware-accelerated transcoding. This is 5–10x faster than CPU and uses minimal CPU resources.

**Check if Intel iGPU is available:**
```bash
ls /dev/dri/
# Should show renderD128
```

**Enable in docker-compose.yml** for the Tdarr service:
```yaml
tdarr:
  devices:
    - /dev/dri:/dev/dri
```

**In Tdarr, use the FFmpeg plugin with:**
```
-hwaccel qsv -c:v hevc_qsv
```

### GPU Transcoding — NVIDIA

If your server has an NVIDIA GPU, install the NVIDIA Container Toolkit first:

```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update && sudo apt install -y nvidia-container-toolkit
sudo systemctl restart docker
```

**Enable in docker-compose.yml** for the Tdarr service:
```yaml
tdarr:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

**In Tdarr, use the FFmpeg plugin with:**
```
-c:v hevc_nvenc -preset slow -cq 23
```

### Hardware Recommendations for Tdarr

| Use Case | Recommended Hardware |
|---|---|
| Light transcoding (1–2 files/day) | Any dual-core CPU, 4 GB RAM |
| Regular library (10–20 files/day) | Quad-core CPU with Intel iGPU, 8 GB RAM |
| Large library (50+ files/day) | Intel N100/N305 mini PC or NVIDIA GTX 1060+, 16 GB RAM |
| 4K HDR transcoding | NVIDIA RTX 2060+, 32 GB RAM |

> **Tip for old PCs:** Even an old Intel Core i5 (4th gen or newer) has Quick Sync and can transcode 1080p at 3–5x realtime speed. This is the most cost-effective upgrade for a home server.

---

## Troubleshooting

### Install script stalls or crashes

**Symptom:** Install stops at a phase with no output.

**Fix:**
```bash
# Check the install log
cat ~/mediaflow/logs/install.log | tail -50

# Check if Docker is running
sudo systemctl status docker

# Re-run the installer (it's idempotent)
bash ~/mediaflow/install.sh
```

### DNS resolution failing during Docker pulls

**Symptom:** `dial tcp: lookup registry-1.docker.io on 127.0.0.53:53: server misbehaving`

**Fix:**
```bash
sudo systemctl restart systemd-resolved

# Permanent fix — add to netplan config
sudo nano /etc/netplan/00-installer-config.yaml
# Add under your interface:
#   nameservers:
#     addresses: [8.8.8.8, 8.8.4.4, 1.1.1.1]
sudo netplan apply
```

### qBittorrent password lost or changed

**Symptom:** Can't log in to qBittorrent, or backend shows `qbit login failed`.

**Retrieve the current session password:**
```bash
docker logs mediaflow_qbittorrent 2>&1 | grep -i "temporary password" | tail -1
```

**Set it permanently:**
1. Log in at `http://YOUR_IP:8082` with the temporary password
2. Go to **Tools → Options → WebUI**
3. Set a new permanent password
4. Update `.env`: `QBIT_PASS=your_new_password`
5. Restart backend: `docker compose restart backend`

### Containers stop after install completes

**Symptom:** All containers running during install but gone afterwards.

**Fix:** Check if the EXIT trap is tearing down on a non-zero exit:
```bash
docker compose up -d
```

### Port already in use

**Symptom:** `Error: bind: address already in use` for a port.

**Find what's using the port:**
```bash
sudo lsof -i :PORT_NUMBER
sudo ss -tlnp | grep PORT_NUMBER
```

Kill the process or change the port in `.env` and `docker-compose.yml`.

### Health checks showing Unhealthy (missing)

**Symptom:** Install shows all containers as unhealthy despite them running.

**This is a display issue only.** Verify containers are actually running:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

If they show `Up X minutes`, the stack is healthy. The health check display issue is cosmetic.

### Jellyseerr showing Unhealthy (starting)

**Symptom:** Jellyseerr shows as starting/unhealthy during install.

**This is normal.** Jellyseerr takes 2–3 minutes to fully initialize. Wait for it — it will become healthy on its own. If it never becomes healthy:
```bash
docker logs mediaflow_jellyseerr --tail=20
```

### Update script permission denied

**Symptom:** `./state/maintenance: Permission denied` during update.

**Fix:**
```bash
sudo chown -R $(whoami):$(whoami) ~/mediaflow/state ~/mediaflow/backups
chmod -R 775 ~/mediaflow/state ~/mediaflow/backups
```

### Prowlarr showing 502 in dashboard

**Symptom:** Indexers tab shows "Cannot reach Prowlarr".

**Check Prowlarr is running:**
```bash
docker ps | grep prowlarr
```

**Check API key is set in `.env`:**
```bash
grep PROWLARR_API_KEY ~/mediaflow/.env
```

If the key is missing, get it from `http://YOUR_IP:9696` → Settings → General → API Key, then:
```bash
echo "PROWLARR_API_KEY=your_key" >> ~/mediaflow/.env
docker compose restart backend
```

### Dashboard shows version "unknown"

**Symptom:** Settings page shows version as "unknown".

**Fix:**
```bash
# Check VERSION file exists in backend container
docker exec mediaflow_backend cat /app/VERSION

# If missing, rebuild
docker compose build --no-cache backend
docker compose up -d backend
```

### Quick links not opening

**Symptom:** Clicking service Open buttons does nothing.

**This was caused by a CSS `::before` pseudo-element intercepting clicks.** Fixed in v1.4.5. If you're on an older version, update:
```bash
MEDIAFLOW_AUTH=1 bash update.sh
```

### sonarr-anime container not found

**Symptom:** Health checks show `sonarr-anime` as missing.

**Note:** Docker replaces hyphens with underscores in container names. The container is named `mediaflow_sonarr_anime` (underscore). This is a known display quirk — the service is running correctly.

---

## Planned Features

These are features being considered for future releases. No timeline is guaranteed.

- **Mobile app** — native iOS/Android companion app for requesting media on the go
- **Jellyfin plugin** — direct Jellyseerr request button inside the Jellyfin app
- **Multi-server support** — manage multiple MediaFlow instances from one dashboard
- **Notifications** — push notifications when downloads complete (Telegram, Discord, Pushover)
- **Storage analytics** — detailed breakdown of disk usage by genre, year, quality
- **Auto-cleanup** — automatically remove watched media after a configurable period
- **Torrent health scoring** — prefer torrents with better seed/leech ratios
- **Scheduled downloads** — queue downloads during off-peak hours
- **Parental controls** — per-user content restrictions by rating
- **Public request page** — shareable link for guests to request media without an account
- **CCTV integration** — first-class support for IP camera streams in Jellyfin
- **Tailscale auto-setup** — one-command external access configuration

---

## Changelog

### v1.4.5 — Current
- Fixed quick links blocked by CSS `::before` pseudo-element (pointer-events: none)
- Fixed version endpoint returning "unknown" (VERSION file path correction)
- Fixed qBittorrent auto password detection and permanent password setting
- Added mobile sidebar with hamburger menu
- Added YouTube video preview player in YouTube tab
- Added YouTube media directory for Jellyfin integration
- Fixed Prowlarr 502 in indexers tab
- Replaced TMDB with OMDB for trending (India-compatible)
- Added per-platform trending tabs (Netflix, Prime, Hotstar, Apple TV+)
- Fixed setup page placeholder text
- Synced install and update scripts with new directory structure

### v1.4.4
- Fixed logo size on login and setup pages (inline styles replacing broken Tailwind)
- Added `/api/version` endpoint to backend
- Replaced window.open with anchor tags in quick links
- Synced version to 1.4.4 across all package files

### v1.4.3
- Fixed SERVER_IP returned from `/api/server/info` (reads from env not hostname)
- Centralised version management to VERSION file
- Added India region filtering to TMDB trending

### v1.4.2
- Fixed sonarr-anime container name underscore vs hyphen in health checks
- Added jellyseerr start_period 180s for slow startup
- Fixed maintenance mode path using absolute $SCRIPT_DIR

### v1.4.1
- Replaced Overseerr with Jellyseerr (native Jellyfin support)
- Fixed tdarr-node non-existent service causing deploy failure
- Fixed health check fallback for containers without HEALTHCHECK defined
- Fixed qBittorrent password capture with robust grep pattern

### v1.4.0
- Added auto-trending downloader with TMDB API and 24hr cron
- Added Trending page with one-click add to Radarr/Sonarr
- Added YouTube downloader with yt-dlp container
- Added service toggles for Sonarr-Anime, Tdarr, Bazarr (later removed)
- Fixed package-lock.json sync issues
- Fixed update script not rebuilding custom images

### v1.3.1
- Replaced Overseerr with Jellyseerr

### v1.3.0
- Added JWT authentication with login page
- Added setup wizard for first-time configuration
- Added three-tier role system (Admin, Requester, Viewer)
- Added user management page with avatar selector
- Added quick links grid on dashboard
- Added update system with password authentication

### v1.2.0
- Added Bazarr for automatic subtitle downloading
- Added dual Sonarr instances (TV + Anime)
- Added Tdarr for automated transcoding
- Added multi-audio profiles (Hindi primary / English secondary)
- Added dashboard health monitor
- Added Jellyfin embedded player
- Added Prowlarr indexers panel
- Added SSE-based update progress streaming

### v1.0.0
- Initial release
- Basic arr stack: Sonarr, Radarr, Prowlarr, qBittorrent, Jellyfin

---

## License & Credits

MediaFlow is released under the [MIT License](LICENSE).

### Built With

| Project | License |
|---|---|
| [Radarr](https://github.com/Radarr/Radarr) | GPL-3.0 |
| [Sonarr](https://github.com/Sonarr/Sonarr) | GPL-3.0 |
| [Prowlarr](https://github.com/Prowlarr/Prowlarr) | GPL-3.0 |
| [qBittorrent](https://www.qbittorrent.org/) | GPL-2.0 |
| [Jellyfin](https://jellyfin.org/) | GPL-2.0 |
| [Bazarr](https://www.bazarr.media/) | GPL-3.0 |
| [Jellyseerr](https://github.com/Fallenbagel/jellyseerr) | MIT |
| [Tdarr](https://home.tdarr.io/) | Custom |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Unlicense |
| [React](https://react.dev/) | MIT |
| [Express](https://expressjs.com/) | MIT |
| [Docker](https://www.docker.com/) | Apache-2.0 |

### Author

**Harsh** ([@ImExtremis](https://github.com/ImExtremis))

---

<div align="center">
<sub>Built with ❤️ for the self-hosting community</sub>
</div>
