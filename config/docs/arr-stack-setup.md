# MediaFlow – Arr-Stack Post-Install Setup

You’ve successfully installed the stack. Now you need to link the services together. 

The easiest way to do this is to configure **Prowlarr** as the central hub, and have it push your indexers and download clients to Sonarr and Radarr.

---

## Step 1: Login to Services
Open these tabs in your browser (IPs shown on the MediaFlow install summary):
- **Jellyfin**: `:8096`
- **Prowlarr**: `:9696`
- **Sonarr**: `:8989`
- **Radarr**: `:7878`
- **qBittorrent**: `:8082`

## Step 2: Configure qBittorrent
1. Login with `admin` and the temporary password (shown at the end of `install.sh` or in `docker logs mediaflow_qbittorrent`).
2. Go to **Settings (gear icon) → Web UI**.
3. Change the **Password** immediately.
4. Go to **Settings → Downloads**.
5. Ensure the **Default Save Path** is set to `/data/torrents/complete` and the **Keep incomplete torrents in** path is `/data/torrents/incomplete`. *(This should be set automatically by MediaFlow's installer, but verify it).*

## Step 3: Configure Prowlarr Indexers
Indexers are where the apps search for media.
1. Open **Prowlarr** and go to **Indexers** → **Add Indexer**.
2. Search for public indexers (e.g., `1337x`, `KickAssTorrents`, `Nyaa` for Anime, `RARBG` mirrors). 
3. Click **Save**. Add 2-3 of them.
4. *For private trackers, you will need your API keys or cookies.*

## Step 4: Link Prowlarr to Sonarr and Radarr
Prowlarr will act as the master and send the indexers to Sonarr/Radarr.
1. In Prowlarr, go to **Settings → Apps**.
2. Click **+** and add **Sonarr**.
   - Sync Level: `Full Sync`
   - Prowlarr Server: `http://prowlarr:9696`
   - Sonarr Server: `http://sonarr:8989`
   - API Key: Get this from Sonarr (`Settings → General → Security`).
3. Click **Save**.
4. Click **+** and add **Radarr**.
   - Sync Level: `Full Sync`
   - Prowlarr Server: `http://prowlarr:9696`
   - Radarr Server: `http://radarr:7878`
   - API Key: Get this from Radarr (`Settings → General → Security`).
5. Click **Save**.
6. Wait 1 minute. The indexers you added in Step 3 will automatically appear in Sonarr and Radarr's settings.

## Step 5: Add qBittorrent as the Download Client
The apps need to know where to send the downloads.
1. In **Sonarr**, go to **Settings → Download Clients**.
2. Click **+** and choose **qBittorrent**.
3. Host: `qbittorrent`
4. Port: `8080`
5. Username: `admin`
6. Password: The password you set in Step 2.
7. Click **Test**. If it turns green, click **Save**.
8. **Repeat** this exact process in **Radarr**.

## Step 6: Configure Jellyfin Libraries
1. Complete the Jellyfin welcome wizard.
2. Go to **Dashboard → Libraries**.
3. Add a **Movies** library. Use the folder path: `/data/media/movies`.
4. Add a **Shows** library. Use the folder path: `/data/media/tv`. 
   *(Note: The `/data` folder maps to the path you set in your `.env` DATA_PATH).*

## Step 7: Use the MediaFlow Dashboard!
1. Open the **MediaFlow Dashboard** (`:8080`).
2. Now that the backend is wired up, you can use the dashboard to set Quality Profiles, Content Ratings, and Language Preferences.
3. MediaFlow will automatically push these preferences into Sonarr and Radarr!
