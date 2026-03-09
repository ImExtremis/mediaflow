# MediaFlow – Self-Hosted Media Automation Dashboard

> One-command install for a complete arr-stack with a beautiful unified config dashboard.

```
Sonarr (x2) · Radarr · Prowlarr · qBittorrent · Jellyfin · Bazarr · Overseerr · Tdarr
```

---

## 🚀 Quick Install

```bash
# Clone or download this repo, then run the installer:
cd mediaflow
bash install.sh
```

That's it. The script handles everything automatically:
- OS Detection (Ubuntu/Debian, Arch, macOS)
- Docker & Docker Compose installation
- Port conflict detection
- Disk space validation
- API key generation
- Firewall rules (ufw/firewalld/iptables)
- Media directory creation
- Pre-configures qBittorrent host-header settings
- Prints a clean summary with all service URLs & credentials at the end

### Requirements
- Ubuntu 20.04+, Debian 11+, Arch Linux, or macOS 12+
- ≥10 GB free disk space (30GB+ recommended for media)
- `sudo` access

## 🆕 v1.2 Changelog

- **Bazarr Subtitles:** Automated subtitle downloading tailored for Movies-Shows (Hindi/English) and Anime (English). *Note: Hinglish is not a recognized language code in subtitle databases, so a Hindi+English combination profile is used instead as the closest equivalent.*
- **Dedicated Anime Sonarr:** A separate `sonarr-anime` instance automatically configured with Prowlarr to explicitly sync from Nyaa.si and AniDex, applying a preferred SubsPlease/Erai-raws Quality Profile.
- **Auto Transcoding (Tdarr):** Integrated Tdarr explicitly set to seamlessly transcode files >10GB to x265 HEVC, preserving all audio/subtitle tracks.
- **Media Requests (Overseerr):** Easily request content via the new Overseerr container, connected instantly to Radarr, Sonarrs, and Jellyfin.
- **Dashboard Enhancements:** 
  - Real-time Health Monitor (disk space, container statuses, active speeds).
  - Built-in "Watch" tab via Jellyfin iframe player.
  - Fixes for Indexer display.
  - Multi-Audio language profiles (and an Anime Mode toggle).

---

## 📡 Service URLs (defaults)

| Service | URL | Default Credentials |
|---|---|---|
| **MediaFlow Dashboard** | `http://server:8080` | No login |
| **Jellyfin** | `http://server:8096` | Setup on first launch |
| **Sonarr** | `http://server:8989` | No auth (set in Settings) |
| **Sonarr-Anime** | `http://server:8990` | No auth (set in Settings) |
| **Radarr** | `http://server:7878` | No auth (set in Settings) |
| **Prowlarr** | `http://server:9696` | No auth (set in Settings) |
| **qBittorrent** | `http://server:8082` | `admin` / **(check install summary)** |
| **Bazarr** | `http://server:6767` | No auth (set in Settings) |
| **Overseerr** | `http://server:5055` | Plex/Jellyfin Login |
| **Tdarr** | `http://server:8265` | No login |

---

## 📦 Post-Install Setup

While MediaFlow stands up the infrastructure, you need to link the applications together so they can talk. **This is a one-time process.**

👉 **Read the guide:** [`config/docs/arr-stack-setup.md`](config/docs/arr-stack-setup.md)

**Quick summary of what you'll do:**
1. Login to **qBittorrent** using the temporary password from the install summary and change it.
2. Add indexers (torrent search sites) to **Prowlarr**.
3. Sync those indexers from Prowlarr to **Sonarr** and **Radarr**.
4. Point Sonarr and Radarr to **qBittorrent** as their download client.
5. Create your media libraries in **Jellyfin**.

---

## 🛠 Troubleshooting: Path Mapping & Permissions
The most common issue with the arr-stack is the "bad remote path mapping" error. This occurs when containers cannot see the download files because their path mappings are misaligned.
- **The Golden Rule:** Every container must see `/data` mapped to the exact same host directory. There are no exceptions. If qBittorrent downloads to `/data/torrents/complete`, Sonarr and Radarr MUST also have that same mapping so they can reliably import the files.
- **Permissions:** MediaFlow guarantees Docker permissions by running containers with `PUID=1000` and `PGID=1000`. The install script automatically chowns the `DATA_PATH` to `1000:1000`.
- **Applying Fixes:** If you accidentally break permissions (e.g. by modifying files as `root`), you can run `bash fix-permissions.sh` at any time to repair the atomic permissions structure for the entire storage tree.
- **Note:** If the server restarts or the network is interrupted, the Arr stack might break due to an IP change. For example, if you set the IP to 192.168.1.100 during setup and after a restart the IP changes to something else, the apps will stop working and will require manual fixes in all of the dashboards.
- **qBittorrent:** There is a known bug where, after installation and setup, qBittorrent returns a failed authentication error when configuring any of the Arr stack apps (Sonarr, Radarr, etc.). To fix this issue, simply reboot your server after setting up qBittorrent. This bug is intentionally left unpatched in this app to demonstrate a classic IT solution: if something breaks, turn it off and turn it back on again. 😄
---

## 🎛️ MediaFlow Dashboard Features

Once your stack is linked up, use the custom **Dashboard at port `8080`** to control your media flow:

- **Service Status:** Live health cards for all 5 services with latency tracking.
- **Content Preferences:** Toggle Anime, Movies, TV, and Documentaries on/off.
- **Quality Profiles:** Choose between 480p, 720p, 1080p, and 4K presets.
- **Rating Filters:** Filter incoming content by G, PG, PG-13, R, or NR MPAA ratings.
- **Storage Paths:** Set and forget your media libraries and download directories.
- **Speed Limits:** Slide controls for global qBittorrent download/upload bandwidth constraints.
- **Languages:** Pick your preferred audio tracks and subtitles (e.g., dual-audio Anime).
- **Indexers:** Live sync table of your active Prowlarr indexers with enable/disable switches.

All preferences are synced out to the underlying arr-stack automatically.

---

## 🔄 Maintenance

```bash
# Update all services to latest and rebuild dashboard
bash update.sh

# Backup configuration and database files to tar.gz
bash backup.sh

# Restore from a previous backup
bash backup.sh restore backups/mediaflow_backup_YYYYMMDD_HHMMSS.tar.gz

# Remove everything (prompted cleanup)
bash uninstall.sh
```

---

## 🗂️ Project Structure

```
mediaflow/
├── install.sh           # One-command installer
├── uninstall.sh         # Clean removal
├── update.sh            # One-command updater
├── backup.sh            # Config backup & restore
├── docker-compose.yml   # Full stack definition
├── config/
│   ├── config.json      # Single config store
│   ├── defaults.json    # Reset state defaults
│   ├── qBittorrent.conf # Pre-seed for qBit 4.6+ host-header fix
│   └── docs/            # Post-install setup guides
├── backend/             # Node.js / Express API
│   ├── server.js        # Core controller
│   └── routes/          # API, Proxy, Health-Checks
└── frontend/            # React + Vite dashboard
    ├── src/
    │   ├── hooks/       # Configuration fetch/save logic
    │   ├── pages/       # 8 unified config views
    │   └── index.css    # Global glassmorphism UI
    ├── Dockerfile       # Multi-stage Nginx builder
    └── nginx.conf       # SPA routing + backend proxy
```

---

## 📜 License

MIT – Built for self-hosters. Keep your media local.
