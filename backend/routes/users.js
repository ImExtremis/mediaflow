const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getUsers, saveUsers } = require('../utils/users');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdmin);

// GET /api/users
router.get('/', (req, res) => {
    try {
        const users = getUsers();
        const safeUsers = users.map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            role: u.role,
            createdAt: u.createdAt,
            lastLogin: u.lastLogin
        }));
        res.json(safeUsers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/users
router.post('/', async (req, res) => {
    try {
        const { displayName, username, password, role } = req.body;
        if (!displayName || !username || !password || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const validRoles = ['admin', 'requester', 'viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const users = getUsers();
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const newUser = {
            id: crypto.randomUUID(),
            username,
            displayName,
            passwordHash,
            role,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        users.push(newUser);
        saveUsers(users);

        res.status(201).json({
            id: newUser.id,
            username: newUser.username,
            displayName: newUser.displayName,
            role: newUser.role,
            createdAt: newUser.createdAt,
            lastLogin: newUser.lastLogin
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
    try {
        const { displayName, role, password } = req.body;
        const users = getUsers();
        const userIndex = users.findIndex(u => u.id === req.params.id);

        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[userIndex];

        if (user.role === 'admin' && role && role !== 'admin') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Cannot change role of the last admin' });
            }
        }

        if (displayName) user.displayName = displayName;
        if (role) user.role = role;
        if (password) {
            user.passwordHash = await bcrypt.hash(password, 12);
        }

        users[userIndex] = user;
        saveUsers(users);

        res.json({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE /api/users/:id
router.delete('/:id', (req, res) => {
    try {
        const users = getUsers();
        const user = users.find(u => u.id === req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.id === req.user.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        if (user.role === 'admin') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Cannot delete the last admin account' });
            }
        }

        const newUsers = users.filter(u => u.id !== req.params.id);
        saveUsers(newUsers);

        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;
