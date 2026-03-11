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

// Helper for unix socket curl essentially
const callDockerSocket = async (method, path) => {
    return axios({
        method,
        socketPath: '/var/run/docker.sock',
        url: `http://localhost/v1.41${path}`
    });
};

// POST /api/services/:id/suspend
router.post('/:id/suspend', async (req, res) => {
    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    const id = req.params.id;
    const allowedMap = {
        'sonarr-anime': 'mediaflow_sonarr_anime',
        'tdarr': 'mediaflow_tdarr',
        'bazarr': 'mediaflow_bazarr'
    };

    const containerName = allowedMap[id];
    if (!containerName) return res.status(400).json({ error: 'Service cannot be toggled' });

    try {
        await callDockerSocket('POST', `/containers/${containerName}/stop`);
        
        // Update .env
        const envPath = require('path').join(__dirname, '../../.env');
        const fs = require('fs');
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            const envKey = `${id.toUpperCase().replace('-', '_')}_ENABLED`;
            if (envContent.includes(envKey + '=')) {
                envContent = envContent.replace(new RegExp(`${envKey}=.*`, 'g'), `${envKey}=false`);
            } else {
                envContent += `\n${envKey}=false\n`;
            }
            fs.writeFileSync(envPath, envContent);
        }
        res.json({ success: true, message: `${id} suspended` });
    } catch (e) {
        console.error(`Failed to suspend ${id}:`, e.message);
        res.status(500).json({ error: 'Failed to suspend container' });
    }
});

// POST /api/services/:id/resume
router.post('/:id/resume', async (req, res) => {
    if (req.user && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    
    const id = req.params.id;
    const allowedMap = {
        'sonarr-anime': 'mediaflow_sonarr_anime',
        'tdarr': 'mediaflow_tdarr',
        'bazarr': 'mediaflow_bazarr'
    };

    const containerName = allowedMap[id];
    if (!containerName) return res.status(400).json({ error: 'Service cannot be toggled' });

    try {
        await callDockerSocket('POST', `/containers/${containerName}/start`);
        
        // Update .env
        const envPath = require('path').join(__dirname, '../../.env');
        const fs = require('fs');
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            const envKey = `${id.toUpperCase().replace('-', '_')}_ENABLED`;
            if (envContent.includes(envKey + '=')) {
                envContent = envContent.replace(new RegExp(`${envKey}=.*`, 'g'), `${envKey}=true`);
            } else {
                envContent += `\n${envKey}=true\n`;
            }
            fs.writeFileSync(envPath, envContent);
        }
        res.json({ success: true, message: `${id} resumed` });
    } catch (e) {
        console.error(`Failed to resume ${id}:`, e.message);
        res.status(500).json({ error: 'Failed to resume container' });
    }
});

module.exports = router;
