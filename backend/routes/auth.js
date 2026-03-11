const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getUsers, saveUsers } = require('../utils/users');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const getSecret = () => process.env.JWT_SECRET || 'default_secret_for_dev_only';

// GET /api/auth/status
router.get('/status', (req, res) => {
    try {
        const users = getUsers();
        res.json({ setupRequired: users.length === 0 });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});

// POST /api/auth/setup
router.post('/setup', async (req, res) => {
    try {
        const users = getUsers();
        if (users.length > 0) {
            return res.status(400).json({ error: 'Setup already complete' });
        }

        const { displayName, username, password } = req.body;
        if (!displayName || !username || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const newUser = {
            id: crypto.randomUUID(),
            username,
            displayName,
            passwordHash,
            role: 'admin',
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        saveUsers([newUser]);

        const token = jwt.sign(
            { userId: newUser.id, username: newUser.username, role: newUser.role, displayName: newUser.displayName },
            getSecret(),
            { expiresIn: '7d' }
        );

        res.json({ message: 'Setup complete', token, user: { id: newUser.id, username: newUser.username, role: newUser.role, displayName: newUser.displayName } });
    } catch (err) {
        res.status(500).json({ error: 'Setup failed' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const users = getUsers();
        const user = users.find(u => u.username === username);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        user.lastLogin = new Date().toISOString();
        saveUsers(users);

        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role, displayName: user.displayName },
            getSecret(),
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username, role: user.role, displayName: user.displayName }
        });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
    try {
        const users = getUsers();
        const user = users.find(u => u.id === req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            user: { id: user.id, username: user.username, role: user.role, displayName: user.displayName }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get user details' });
    }
});

module.exports = router;
