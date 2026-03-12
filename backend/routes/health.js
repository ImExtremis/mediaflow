'use strict';

const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const router = express.Router();

const SERVICES = [
    { id: 'sonarr', name: 'Sonarr', url: process.env.SONARR_URL || 'http://sonarr:8989', pingPath: '/ping' },
    { id: 'radarr', name: 'Radarr', url: process.env.RADARR_URL || 'http://radarr:7878', pingPath: '/ping' },
    { id: 'sonarr-anime', name: 'Sonarr-Anime', url: process.env.SONARR_ANIME_URL || 'http://sonarr-anime:8989', pingPath: '/ping' },
    { id: 'prowlarr', name: 'Prowlarr', url: process.env.PROWLARR_URL || 'http://prowlarr:9696', pingPath: '/ping' },
    { id: 'qbittorrent', name: 'qBittorrent', url: process.env.QBIT_URL || 'http://qbittorrent:8080', pingPath: '/api/v2/app/version' },
    { id: 'jellyfin', name: 'Jellyfin', url: process.env.JELLYFIN_URL || 'http://jellyfin:8096', pingPath: '/health' },
    { id: 'bazarr', name: 'Bazarr', url: process.env.BAZARR_URL || 'http://bazarr:6767', pingPath: '/ping' },
    { id: 'overseerr', name: 'Overseerr', url: process.env.OVERSEERR_URL || 'http://overseerr:5055', pingPath: '/api/v1/status' },
    { id: 'tdarr', name: 'Tdarr', url: process.env.TDARR_URL || 'http://tdarr:8265', pingPath: '/' }
];

async function getDiskSpace() {
    try {
        const { stdout } = await execPromise('df -k /data');
        const lines = stdout.trim().split('\n');
        if (lines.length < 2) throw new Error('Invalid df output');
        
        const parts = lines[1].trim().split(/\s+/);
        const totalKb = parseInt(parts[1], 10);
        const usedKb = parseInt(parts[2], 10);
        const availableKb = parseInt(parts[3], 10);

        return {
            totalBytes: totalKb * 1024,
            usedBytes: usedKb * 1024,
            availableBytes: availableKb * 1024,
            usedPercent: (usedKb / totalKb) * 100
        };
    } catch (err) {
        console.error('Disk space error:', err.message);
        return { error: 'Unable to read disk space', usedPercent: 0 };
    }
}

async function getServiceHealth() {
    const results = await Promise.all(SERVICES.map(async (svc) => {
        try {
            await axios.get(`${svc.url}${svc.pingPath}`, { timeout: 3000, validateStatus: s => s < 500 });
            return { id: svc.id, name: svc.name, status: 'healthy' };
        } catch (err) {
            return { id: svc.id, name: svc.name, status: 'unhealthy', error: err.message };
        }
    }));
    return results;
}

// Global Auth Header logic for qBittorrent
let qbitCookie = null;
async function getQbitAuth() {
    if (qbitCookie) return qbitCookie;
    try {
        const username = process.env.QBIT_USER || 'admin';
        const password = process.env.QBIT_PASS || 'adminadmin';
        const res = await axios.post(`${process.env.QBIT_URL || 'http://qbittorrent:8080'}/api/v2/auth/login`, 
            `username=${username}&password=${password}`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 3000 }
        );
        const cookies = res.headers['set-cookie'];
        if (cookies) {
            qbitCookie = cookies[0].split(';')[0];
            return qbitCookie;
        }
    } catch(err) {
        console.error('qbit login failed', err.message);
    }
    return null;
}

async function getQbitStats() {
    let cookie = await getQbitAuth();
    if (!cookie) return { downloadSpeed: 0, uploadSpeed: 0, activeDownloads: 0 };
    try {
        const res = await axios.get(`${process.env.QBIT_URL || 'http://qbittorrent:8080'}/api/v2/sync/maindata`, {
            headers: { Cookie: cookie },
            timeout: 3000
        });
        const serverState = res.data?.server_state || {};
        const torrents = res.data?.torrents || {};
        
        const active = Object.values(torrents).filter(t => t.state === 'downloading' || t.state === 'stalledDL' || t.state === 'stalledUP' || t.state === 'uploading').length;

        return {
            downloadSpeed: serverState.dl_info_speed || 0,
            uploadSpeed: serverState.up_info_speed || 0,
            activeDownloads: active
        };
    } catch(err) {
        if (err.response?.status === 403) qbitCookie = null; // Reset auth
        return { downloadSpeed: 0, uploadSpeed: 0, activeDownloads: 0 };
    }
}

async function getArrQueue(url, apiKey) {
    if (!apiKey) return 0;
    try {
        const res = await axios.get(`${url}/api/v3/queue`, {
            headers: { 'X-Api-Key': apiKey },
            timeout: 3000
        });
        return res.data?.totalRecords || res.data?.length || 0;
    } catch (err) {
        return 0;
    }
}

// GET /api/health-monitor
router.get('/', async (req, res) => {
    try {
        const [disk, services, qbit, radarrQ, sonarrQ, sonarrAnimeQ] = await Promise.all([
            getDiskSpace(),
            getServiceHealth(),
            getQbitStats(),
            getArrQueue(process.env.RADARR_URL || 'http://radarr:7878', process.env.RADARR_API_KEY),
            getArrQueue(process.env.SONARR_URL || 'http://sonarr:8989', process.env.SONARR_API_KEY),
            getArrQueue(process.env.SONARR_ANIME_URL || 'http://sonarr-anime:8989', process.env.SONARR_API_KEY) // Sonarr-anime uses the same API key as Sonarr generally based on the install script
        ]);

        const queues = {
            radarr: radarrQ,
            sonarr: sonarrQ,
            sonarrAnime: sonarrAnimeQ
        };

        res.json({
            disk,
            services,
            torrentStats: qbit,
            queues
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
