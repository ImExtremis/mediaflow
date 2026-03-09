// =============================================================================
//  MediaFlow Backend API · server.js
// =============================================================================
'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const configRoutes = require('./routes/config');
const servicesRoutes = require('./routes/services');
const proxyRoutes = require('./routes/proxy');
const healthRoutes = require('./routes/health');
const indexersRoutes = require('./routes/indexers');
const jellyfinRoutes = require('./routes/jellyfin');
const updateRoutes = require('./routes/update');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

// ─── Maintenance Mode Middleware ──────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api/update') || req.path === '/health' || req.path.startsWith('/api/health-monitor')) {
    return next();
  }
  const stateDir = process.env.STATE_DIR || path.join(__dirname, '../../state');
  const maintenanceFile = path.join(stateDir, 'maintenance');
  if (fs.existsSync(maintenanceFile)) {
    return res.status(503).json({ status: "maintenance", message: "MediaFlow is updating, please wait" });
  }
  next();
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.2.1' });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/config', configRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/health-monitor', healthRoutes);
app.use('/api/indexers', indexersRoutes);
app.use('/api/jellyfin', jellyfinRoutes);
app.use('/api/update', updateRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[MediaFlow API] Running on port ${PORT}`);
  console.log(`[MediaFlow API] Config path: ${process.env.CONFIG_PATH || '/app/config/config.json'}`);
});

module.exports = app;
