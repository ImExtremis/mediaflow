'use strict';

const express = require('express');
const router = express.Router();

const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY || '';
// We want to pass back the host IP without the docker internal hostname (e.g. without http://jellyfin)
// We'll read the client's host or rely on a config. If not configured, we'll try to extract from the request host
router.get('/info', (req, res) => {
    // Attempt to determine the base URL to connect to Jellyfin. 
    // The dashboard is accessed via http://server-ip:8080. 
    // Jellyfin is usually at http://server-ip:8096.

    // We can parse the server IP from req.hostname
    let serverIp = req.hostname;
    if (serverIp === 'localhost' || serverIp === '127.0.0.1') {
        serverIp = req.hostname;
    }

    // Fallback if there's a problem determining it
    const port = process.env.JELLYFIN_PORT || 8096;
    const protocol = req.protocol || 'http';
    const jellyfinUrl = `${protocol}://${serverIp}:${port}`;

    res.json({
        url: jellyfinUrl,
        apiKey: JELLYFIN_API_KEY
    });
});

module.exports = router;
