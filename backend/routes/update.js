'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');
const { getUsers } = require('../utils/users');

const router = express.Router();

let updateCache = null;
let updateCacheTime = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

const GITHUB_REPO = process.env.GITHUB_REPO || 'ImExtremis/media-flow';
const VERSION_FILE = path.join(__dirname, '../../../VERSION');
const UPDATE_SCRIPT = path.join(__dirname, '../../../update.sh');

let currentUpdateProcess = null;
let updateLogs = [];
let updateClients = [];

// Helper to read current config and get updateChannel
function getUpdateChannel() {
    const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, '../../config', 'config.json');
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            return cfg.updateChannel || 'stable';
        }
    } catch (err) {
        console.error("[Update API] Error reading config for update channel, defaulting to stable", err);
    }
    return 'stable';
}

router.get('/check', async (req, res) => {
    try {
        if (!process.env.GITHUB_REPO) {
            return res.json({
                updateAvailable: false,
                currentVersion: fs.existsSync(VERSION_FILE) ? fs.readFileSync(VERSION_FILE, 'utf8').trim() : 'unknown',
                message: 'GITHUB_REPO not configured'
            });
        }

        let currentVersion = 'unknown';
        if (fs.existsSync(VERSION_FILE)) {
            currentVersion = fs.readFileSync(VERSION_FILE, 'utf8').trim();
        }

        const channel = getUpdateChannel();

        if (updateCache && (Date.now() - updateCacheTime < CACHE_TTL) && updateCache.channel === channel) {
            return res.json({ ...updateCache.data, currentVersion });
        }

        let latestVersion = currentVersion;
        let changelog = '';
        let publishedAt = '';
        let updateAvailable = false;

        if (channel === 'beta') {
            // Check commits
            const resp = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/commits?sha=main`);
            if (resp.data && resp.data.length > 0) {
                latestVersion = resp.data[0].sha.substring(0, 7); // short commit hash
                changelog = resp.data[0].commit.message;
                publishedAt = resp.data[0].commit.author.date;
                updateAvailable = currentVersion !== latestVersion;
            }
        } else {
            // stable: tagged releases
            const resp = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
            if (resp.data) {
                latestVersion = resp.data.tag_name;
                changelog = resp.data.body;
                publishedAt = resp.data.published_at;
                updateAvailable = currentVersion !== latestVersion;
            }
        }

        const data = {
            updateAvailable,
            latestVersion,
            changelog,
            publishedAt
        };

        updateCache = { channel, data };
        updateCacheTime = Date.now();

        res.json({ ...data, currentVersion });
    } catch (err) {
        console.error("[Update API] Update check failed", err.message);
        if (err.response && err.response.status === 404) {
            return res.json({
              updateAvailable: false,
              currentVersion: fs.existsSync(VERSION_FILE) ? fs.readFileSync(VERSION_FILE, 'utf8').trim() : 'unknown',
              latestVersion: fs.existsSync(VERSION_FILE) ? fs.readFileSync(VERSION_FILE, 'utf8').trim() : 'unknown',
              message: 'No GitHub releases found. Create a release tag to enable update checks.'
            });
        }
        res.json({ updateAvailable: false, currentVersion: fs.existsSync(VERSION_FILE) ? fs.readFileSync(VERSION_FILE, 'utf8').trim() : 'unknown', message: 'Update check failed' });
    }
});


router.post('/start', (req, res) => {
    if (currentUpdateProcess) {
        return res.status(400).json({ error: "Update already in progress" });
    }
    startUpdateProcess(['bash', UPDATE_SCRIPT]);
    res.json({ success: true, message: "Update started" });
});

router.post('/verify-and-start', async (req, res) => {
    try {
        if (currentUpdateProcess) {
            return res.status(400).json({ error: "Update already in progress" });
        }

        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }

        const users = getUsers();
        // The user ID is added to req.user by requireAdmin middleware in server.js
        const user = users.find(u => u.id === req.user.userId);

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(403).json({ error: "Incorrect password" });
        }

        startUpdateProcess(['bash', UPDATE_SCRIPT]);
        res.json({ success: true, message: "Update started" });
    } catch (err) {
        console.error("[Update API] Error verifying password for update:", err);
        res.status(500).json({ error: "Failed to verify password" });
    }
});

router.post('/rollback', (req, res) => {
    if (currentUpdateProcess) {
        return res.status(400).json({ error: "Update already in progress" });
    }
    startUpdateProcess(['bash', UPDATE_SCRIPT, '--rollback']);
    res.json({ success: true, message: "Rollback started" });
});

function startUpdateProcess(cmdArgs) {
    updateLogs = [];
    const spawnEnv = { ...process.env, MEDIAFLOW_AUTH: '1' };
    currentUpdateProcess = spawn(cmdArgs[0], cmdArgs.slice(1), {
        cwd: path.join(__dirname, '../../../'),
        env: spawnEnv,
        detached: true
    });

    const broadcast = (data) => {
        const str = data.toString();
        // If it's a massive log block, split it or keep it as is
        updateLogs.push(str);
        updateClients.forEach(client => client.res.write(`data: ${JSON.stringify({ log: str })}\n\n`));
    };

    currentUpdateProcess.stdout.on('data', broadcast);
    currentUpdateProcess.stderr.on('data', broadcast);

    currentUpdateProcess.on('close', (code) => {
        broadcast(`\n[SYSTEM] Process exited with code ${code}\n`);
        const result = { success: code === 0, code };
        updateClients.forEach(client => {
            client.res.write(`data: ${JSON.stringify({ log: null, done: true, result })}\n\n`);
            client.res.end();
        });
        updateClients = [];
        currentUpdateProcess = null;
    });
}

router.get('/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Flush headers to ensure the browser gets it immediately
    res.flushHeaders?.();

    if (!currentUpdateProcess && updateLogs.length === 0) {
        res.write(`data: ${JSON.stringify({ log: 'No update running or successfully completed.\n', done: true })}\n\n`);
        return res.end();
    }

    // Send existing logs
    updateLogs.forEach(log => {
        res.write(`data: ${JSON.stringify({ log })}\n\n`);
    });

    if (!currentUpdateProcess) {
        // Finished
        res.write(`data: ${JSON.stringify({ done: true, log: null, result: { success: true, code: 0 } })}\n\n`); // We don't have exit code from old process lying around, assuming success if logs exist but no process
        return res.end();
    }

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    updateClients.push(newClient);

    req.on('close', () => {
        updateClients = updateClients.filter(c => c.id !== clientId);
    });
});

router.get('/status', (req, res) => {
    res.json({ updateInProgress: currentUpdateProcess !== null });
});

router.get('/history', (req, res) => {
    const historyFile = path.join(__dirname, '../../../logs/update-history.log');
    if (!fs.existsSync(historyFile)) {
        return res.json([]);
    }
    try {
        const lines = fs.readFileSync(historyFile, 'utf8').split('\n').filter(Boolean);
        const history = lines.map(line => {
            try { return JSON.parse(line); } catch (e) { return null; }
        }).filter(Boolean).reverse();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: "Failed to read history" });
    }
});

module.exports = router;
