// =============================================================================
//  MediaFlow Backend · routes/proxy.js
//  Proxy API requests to downstream arr services
// =============================================================================
'use strict';

const express = require('express');
const axios = require('axios');

const router = express.Router();

const UPSTREAM = {
    sonarr: { baseUrl: process.env.SONARR_URL || 'http://sonarr:8989', apiKey: process.env.SONARR_API_KEY || '' },
    radarr: { baseUrl: process.env.RADARR_URL || 'http://radarr:7878', apiKey: process.env.RADARR_API_KEY || '' },
    prowlarr: { baseUrl: process.env.PROWLARR_URL || 'http://prowlarr:9696', apiKey: process.env.PROWLARR_API_KEY || '' },
    jellyfin: { baseUrl: process.env.JELLYFIN_URL || 'http://jellyfin:8096', apiKey: process.env.JELLYFIN_API_KEY || '' },
    qbittorrent: { baseUrl: process.env.QBIT_URL || 'http://qbittorrent:8080', apiKey: null },
};

async function proxyRequest(service, subPath, method, body, res) {
    const upstream = UPSTREAM[service];
    if (!upstream) return res.status(404).json({ error: `Unknown service: ${service}` });

    const url = `${upstream.baseUrl}${subPath}`;
    const headers = { 'Content-Type': 'application/json' };
    if (upstream.apiKey) headers['X-Api-Key'] = upstream.apiKey;

    try {
        const response = await axios({
            method: method || 'GET',
            url,
            headers,
            data: body,
            timeout: 10000,
            validateStatus: () => true,
        });
        res.status(response.status).json(response.data);
    } catch (err) {
        res.status(502).json({ error: `Proxy error: ${err.message}` });
    }
}

// Generic proxy: GET /api/proxy/:service/*
router.get('/:service/*', (req, res) => {
    const { service } = req.params;
    const subPath = '/' + (req.params[0] || '');
    proxyRequest(service, subPath, 'GET', null, res);
});

router.post('/:service/*', (req, res) => {
    const { service } = req.params;
    const subPath = '/' + (req.params[0] || '');
    proxyRequest(service, subPath, 'POST', req.body, res);
});

router.put('/:service/*', (req, res) => {
    const { service } = req.params;
    const subPath = '/' + (req.params[0] || '');
    proxyRequest(service, subPath, 'PUT', req.body, res);
});

router.delete('/:service/*', (req, res) => {
    const { service } = req.params;
    const subPath = '/' + (req.params[0] || '');
    proxyRequest(service, subPath, 'DELETE', null, res);
});

// ─── Convenience: Sonarr quality profiles ────────────────────────────────────
router.get('/sonarr/quality', async (_req, res) => {
    const upstream = UPSTREAM.sonarr;
    try {
        const r = await axios.get(`${upstream.baseUrl}/api/v3/qualityprofile`, {
            headers: { 'X-Api-Key': upstream.apiKey },
            timeout: 8000,
        });
        res.json(r.data);
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// ─── Convenience: Prowlarr indexers ──────────────────────────────────────────
router.get('/prowlarr/indexers', async (_req, res) => {
    const upstream = UPSTREAM.prowlarr;
    try {
        const r = await axios.get(`${upstream.baseUrl}/api/v1/indexer`, {
            headers: { 'X-Api-Key': upstream.apiKey },
            timeout: 8000,
        });
        res.json(r.data);
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

// ─── Convenience: qBittorrent transfer info (speed) ──────────────────────────
router.get('/qbittorrent/transfer', async (_req, res) => {
    const upstream = UPSTREAM.qbittorrent;
    try {
        const r = await axios.get(`${upstream.baseUrl}/api/v2/transfer/info`, {
            timeout: 5000,
        });
        res.json(r.data);
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

module.exports = router;
