'use strict';

const express = require('express');
const axios = require('axios');

const router = express.Router();
const PROWLARR_URL = process.env.PROWLARR_URL || 'http://prowlarr:9696';
const PROWLARR_API_KEY = process.env.PROWLARR_API_KEY || '';

// GET /api/indexers
router.get('/', async (_req, res) => {
    if (!PROWLARR_API_KEY) return res.status(500).json({ error: 'Prowlarr API key not configured' });
    try {
        const response = await axios.get(`${PROWLARR_URL}/api/v1/indexer`, {
            headers: { 'X-Api-Key': PROWLARR_API_KEY },
            timeout: 5000
        });

        // Transform response into a normalized format
        const indexers = response.data.map(idx => ({
            id: idx.id,
            name: idx.name,
            type: idx.implementation || idx.protocol,
            enabled: idx.enable,
            categories: idx.fields
                ? (idx.fields.find(f => f.name === 'categories')?.value || [])
                : [],
            lastSyncTime: idx.added || null
        }));

        res.json(indexers);
    } catch (err) {
        res.status(502).json({ error: `Failed to fetch indexers: ${err.message}` });
    }
});

// POST /api/indexers/sync
router.post('/sync', async (_req, res) => {
    if (!PROWLARR_API_KEY) return res.status(500).json({ error: 'Prowlarr API key not configured' });
    try {
        // Prowlarr triggers an app profile sync using the command API
        const response = await axios.post(`${PROWLARR_URL}/api/v1/command`, {
            name: 'ApplicationSearchSync'
        }, {
            headers: { 'X-Api-Key': PROWLARR_API_KEY },
            timeout: 5000
        });

        res.json({ success: true, message: 'Sync triggered', data: response.data });
    } catch (err) {
        res.status(502).json({ error: `Failed to trigger sync: ${err.message}` });
    }
});

module.exports = router;
