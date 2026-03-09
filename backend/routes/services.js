// =============================================================================
//  MediaFlow Backend · routes/services.js
//  Health-check all downstream services
// =============================================================================
'use strict';

const express = require('express');
const axios = require('axios');

const router = express.Router();

const SERVICES = [
    {
        id: 'sonarr',
        name: 'Sonarr',
        url: process.env.SONARR_URL || 'http://sonarr:8989',
        apiKey: process.env.SONARR_API_KEY || '',
        icon: '📺',
        pingPath: '/ping',
    },
    {
        id: 'radarr',
        name: 'Radarr',
        url: process.env.RADARR_URL || 'http://radarr:7878',
        apiKey: process.env.RADARR_API_KEY || '',
        icon: '🎬',
        pingPath: '/ping',
    },
    {
        id: 'prowlarr',
        name: 'Prowlarr',
        url: process.env.PROWLARR_URL || 'http://prowlarr:9696',
        apiKey: process.env.PROWLARR_API_KEY || '',
        icon: '🔍',
        pingPath: '/ping',
    },
    {
        id: 'qbittorrent',
        name: 'qBittorrent',
        url: process.env.QBIT_URL || 'http://qbittorrent:8080',
        apiKey: null,
        icon: '⬇️',
        pingPath: '/api/v2/app/version',
    },
    {
        id: 'jellyfin',
        name: 'Jellyfin',
        url: process.env.JELLYFIN_URL || 'http://jellyfin:8096',
        apiKey: process.env.JELLYFIN_API_KEY || '',
        icon: '🎞️',
        pingPath: '/health',
    },
];

const TIMEOUT_MS = 4000;

async function checkService(svc) {
    const start = Date.now();
    try {
        const headers = {};
        if (svc.apiKey) headers['X-Api-Key'] = svc.apiKey;

        const response = await axios.get(`${svc.url}${svc.pingPath}`, {
            headers,
            timeout: TIMEOUT_MS,
            validateStatus: (s) => s < 500,
        });

        const latency = Date.now() - start;
        return {
            id: svc.id,
            name: svc.name,
            icon: svc.icon,
            url: svc.url,
            status: 'online',
            latency: `${latency}ms`,
            code: response.status,
        };
    } catch (err) {
        return {
            id: svc.id,
            name: svc.name,
            icon: svc.icon,
            url: svc.url,
            status: 'offline',
            latency: null,
            error: err.code || err.message,
        };
    }
}

// GET /api/services  – health check all services
router.get('/', async (_req, res) => {
    const results = await Promise.all(SERVICES.map(checkService));
    const online = results.filter((r) => r.status === 'online').length;
    res.json({
        summary: { online, total: SERVICES.length },
        services: results,
    });
});

// GET /api/services/:id  – check single service
router.get('/:id', async (req, res) => {
    const svc = SERVICES.find((s) => s.id === req.params.id);
    if (!svc) return res.status(404).json({ error: 'Service not found' });
    const result = await checkService(svc);
    res.json(result);
});

module.exports = router;
