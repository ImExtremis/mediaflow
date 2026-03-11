#!/usr/bin/env bash
# =============================================================================
#  MediaFlow · fix-permissions.sh
#  Utility to forcefully reset TRaSH Guide atomic path permissions for Docker
# =============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "[INFO]  Stopping MediaFlow stack..."
docker compose down || true

echo "[INFO]  Applying explicit permissions to ./data, ./appdata, ./state, and ./logs..."
mkdir -p ./data/media/movies \
         ./data/media/tv \
         ./data/media/anime \
         ./data/media/music \
         ./data/torrents/complete \
         ./data/torrents/incomplete \
         ./data/torrents/movies \
         ./data/torrents/tv \
         ./data/transcode_cache \
         ./data/yt-downloads \
         ./appdata/radarr \
         ./appdata/sonarr \
         ./appdata/sonarr-anime \
         ./appdata/prowlarr \
         ./appdata/qbittorrent/qBittorrent \
         ./appdata/jellyfin \
         ./appdata/bazarr \
         ./appdata/jellyseerr \
         ./appdata/tdarr/server \
         ./state \
         ./logs

sudo chown -R 1000:1000 ./data ./appdata ./state ./logs && sudo chmod -R 775 ./data ./appdata ./state ./logs

echo "[INFO]  Restarting MediaFlow stack..."
docker compose up -d

echo "[OK]    Permissions fixed!"
