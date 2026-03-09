// =============================================================================
//  MediaFlow Backend · routes/config.js
//  Read & write config.json
// =============================================================================
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const CONFIG_PATH = process.env.CONFIG_PATH || path.join('/app', 'config', 'config.json');

function readConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error(`config.json not found at ${CONFIG_PATH}`);
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function writeConfig(data) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// GET /api/config
router.get('/', (_req, res, next) => {
    try {
        const config = readConfig();
        res.json(config);
    } catch (err) {
        next(err);
    }
});

// PUT /api/config  – merge partial updates into existing config
router.put('/', (req, res, next) => {
    try {
        const existing = readConfig();
        const updated = deepMerge(existing, req.body);
        writeConfig(updated);
        res.json({ success: true, config: updated });
    } catch (err) {
        next(err);
    }
});

// PUT /api/config/reset  – restore defaults
router.put('/reset', (_req, res, next) => {
    try {
        const defaults = require('../config/defaults.json');
        writeConfig(defaults);
        res.json({ success: true, config: defaults });
    } catch (err) {
        next(err);
    }
});

// GET /api/config/paths/check - verify if mapped paths exist and are accessible
router.get('/paths/check', (_req, res, next) => {
    try {
        const config = readConfig();
        const storage = config.storage || {};
        const results = {};

        for (const [key, dirPath] of Object.entries(storage)) {
            if (!dirPath) continue;
            
            try {
                // fs.accessSync with W_OK throws an error if not reachable
                fs.accessSync(dirPath, fs.constants.W_OK);
                results[key] = { valid: true };
            } catch (err) {
                results[key] = { valid: false, error: err.message };
            }
        }

        res.json({ success: true, checks: results });
    } catch (err) {
        next(err);
    }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function deepMerge(target, source) {
    const output = Object.assign({}, target);
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            output[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            output[key] = source[key];
        }
    }
    return output;
}

module.exports = router;
