const express = require('express');
const router = express.Router();
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// State and configuration
let state = {
    lastRunTime: null,
    itemsAdded: 0,
    nextScheduledRun: null
};

let config = {
    enabled: true,
    schedule: '0 3 * * *', // daily at 3am
    maxMovies: 10,
    maxShows: 10,
    source: 'both' // 'movie', 'tv', 'both'
};

const LOG_FILE = path.join(__dirname, '../../../logs/trending.log');
const CONFIG_FILE = path.join(__dirname, '../../config/trending.json');

// Ensure log dir exists
if (!fs.existsSync(path.dirname(LOG_FILE))) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function logAction(title, added, isExists) {
    const timestamp = new Date().toISOString();
    const status = added ? 'ADDED' : (isExists ? 'EXISTS' : 'FAILED');
    const msg = `[${timestamp}] [${status}] ${title}\n`;
    fs.appendFileSync(LOG_FILE, msg);
    console.log(msg.trim());
}

// Load config if exists
if (fs.existsSync(CONFIG_FILE)) {
    try {
        config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    } catch (e) {
        console.error('Failed to load trending config', e);
    }
}

function saveConfig() {
    try {
        if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
            fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error('Failed to save trending config', e);
    }
}

let cronJob = null;

function setupCron() {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
    }
    if (config.enabled && config.schedule) {
        try {
            cronJob = cron.schedule(config.schedule, () => {
                runTrendingJob();
            });
            state.nextScheduledRun = getNextRun(config.schedule);
        } catch (e) {
            console.error('Invalid cron schedule', e);
        }
    } else {
        state.nextScheduledRun = null;
    }
}

function getNextRun(scheduleStr) {
    // Simple mock or use cron library internals if needed
    // Usually node-cron doesn't easily expose next date natively, 
    // we return static or use cron parsing
    return "Scheduled based on: " + scheduleStr;
}

const OMDB_API_KEY = process.env.OMDB_API_KEY;

// JustWatch API for trending (no API key needed)
const JUSTWATCH_API = 'https://apis.justwatch.com/content/titles/en_IN/popular';


async function checkRadarrExists(tmdbId) {
    try {
        const radarrUrl = process.env.RADARR_URL || 'http://radarr:7878';
        const radarrApiKey = process.env.RADARR_API_KEY;
        const res = await axios.get(`${radarrUrl}/api/v3/movie?tmdbId=${tmdbId}`, {
            headers: { 'X-Api-Key': radarrApiKey }
        });
        return res.data && res.data.length > 0;
    } catch (e) {
        console.error('Radarr exist check failed', e.message);
        return false;
    }
}

async function checkSonarrExists(tvdbId) {
    if (!tvdbId) return false;
    try {
        const sonarrUrl = process.env.SONARR_URL || 'http://sonarr:8989';
        const sonarrApiKey = process.env.SONARR_API_KEY;
        const res = await axios.get(`${sonarrUrl}/api/v3/series?tvdbId=${tvdbId}`, {
            headers: { 'X-Api-Key': sonarrApiKey }
        });
        return res.data && res.data.length > 0;
    } catch (e) {
        console.error('Sonarr exist check failed', e.message);
        return false;
    }
}

async function addMovieToRadarr(movie) {
    try {
        const radarrUrl = process.env.RADARR_URL || 'http://radarr:7878';
        const radarrApiKey = process.env.RADARR_API_KEY;

        await axios.post(`${radarrUrl}/api/v3/movie`, {
            title: movie.title,
            tmdbId: movie.id,
            qualityProfileId: 1,
            rootFolderPath: '/data/media/movies',
            monitored: true,
            addOptions: { searchForMovie: true }
        }, {
            headers: { 'X-Api-Key': radarrApiKey }
        });
        return true;
    } catch (e) {
        console.error('Radarr add failed', e.message);
        return false;
    }
}

async function addShowToSonarr(show, tvdbId) {
    try {
        const sonarrUrl = process.env.SONARR_URL || 'http://sonarr:8989';
        const sonarrApiKey = process.env.SONARR_API_KEY;

        await axios.post(`${sonarrUrl}/api/v3/series`, {
            title: show.name,
            tvdbId: tvdbId,
            qualityProfileId: 1,
            rootFolderPath: '/data/media/tv',
            monitored: true,
            addOptions: { searchForMissingEpisodes: true }
        }, {
            headers: { 'X-Api-Key': sonarrApiKey }
        });
        return true;
    } catch (e) {
        console.error('Sonarr add failed', e.message);
        return false;
    }
}

async function getTmdbId(title, type = 'movie') {
    if (!OMDB_API_KEY) return null;
    try {
        const res = await axios.get(`http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`);
        if (res.data && res.data.imdbID) {
            // Radarr/Sonarr can often accept IMDb IDs in search
            // But if we specifically need TMDB, we'd need another call or just use IMDb
            return res.data.imdbID;
        }
        return null;
    } catch (e) {
        console.error('OMDB lookup failed', e.message);
        return null;
    }
}

async function runTrendingJob() {
    console.log('Starting Trending Content Download Job (JustWatch)...');
    let addedCount = 0;

    try {
        const res = await axios.post(JUSTWATCH_API, {
            content_types: ["show", "movie"],
            page: 1,
            page_size: 40
        }, { headers: { 'Content-Type': 'application/json' } });
        
        const items = res.data.items || [];
        let moviesProcessed = 0;
        let showsProcessed = 0;

        for (const item of items) {
            const isMovie = item.object_type === 'movie';
            if (isMovie && moviesProcessed >= config.maxMovies) continue;
            if (!isMovie && showsProcessed >= config.maxShows) continue;

            const imdbId = await getTmdbId(item.title, item.object_type);
            if (!imdbId) continue;

            if (isMovie) {
                const exists = await checkRadarrExists(imdbId);
                if (!exists) {
                    const success = await addMovieToRadarr({ title: item.title, id: imdbId });
                    logAction(item.title, success, false);
                    if (success) {
                        addedCount++;
                        moviesProcessed++;
                    }
                }
            } else {
                // For Sonarr we need TVDB usually, but Sonarr V3+ can handle IMDb/TMDB in search via API sometimes
                // Simplification for trending: we use the title search if ID fails
                const exists = await checkSonarrExists(imdbId);
                if (!exists) {
                    const success = await addShowToSonarr({ name: item.title }, imdbId);
                    logAction(item.title, success, false);
                    if (success) {
                        addedCount++;
                        showsProcessed++;
                    }
                }
            }
        }
    } catch (e) {
        console.error('Trending job failed', e.message);
    }

    state.lastRunTime = new Date().toISOString();
    state.itemsAdded = addedCount;
    if (config.enabled && config.schedule) {
        state.nextScheduledRun = getNextRun(config.schedule);
    }
    console.log('Trending job finished. Added: ' + addedCount);
}

// Initial setup
setupCron();

// --- API Endpoints ---

router.get('/status', (req, res) => {
    res.json(state);
});

router.post('/run-now', async (req, res) => {
    if (req.user && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Run async
    runTrendingJob().catch(e => console.error(e));
    res.json({ success: true, message: 'Job started' });
});

router.get('/config', (req, res) => {
    res.json(config);
});

router.put('/config', (req, res) => {
    if (req.user && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { enabled, schedule, maxMovies, maxShows, source } = req.body;
    if (enabled !== undefined) config.enabled = !!enabled;
    if (schedule) config.schedule = schedule;
    if (maxMovies !== undefined) config.maxMovies = parseInt(maxMovies, 10);
    if (maxShows !== undefined) config.maxShows = parseInt(maxShows, 10);
    if (source) config.source = source;

    saveConfig();
    setupCron();

    res.json({ success: true, config });
});

router.get('/movies', async (req, res) => {
    try {
        const jwRes = await axios.post(JUSTWATCH_API, {
            content_types: ["movie"], page: 1, page_size: 40
        }, { headers: { 'Content-Type': 'application/json' } });
        
        const radarrUrl = process.env.RADARR_URL || 'http://radarr:7878';
        const radarrApiKey = process.env.RADARR_API_KEY;

        let radarrMovies = [];
        try {
            const radarrRes = await axios.get(`${radarrUrl}/api/v3/movie`, { headers: { 'X-Api-Key': radarrApiKey } });
            radarrMovies = radarrRes.data || [];
        } catch (e) { }

        const mapped = jwRes.data.items.map(m => {
            // JustWatch doesn't provide TMDB ID directly in this endpoint easily
            // We match by title as a best-effort for the UI status
            const rMatch = radarrMovies.find(rm => rm.title.toLowerCase() === m.title.toLowerCase());
            let status = 'missing';
            if (rMatch) {
                status = rMatch.hasFile ? 'available' : 'downloading';
            }
            return {
                tmdbId: m.id, // This is JustWatch ID actually
                title: m.title,
                year: m.original_release_year || '',
                posterURL: m.poster ? `https://images.justwatch.com${m.poster.replace('{profile}', 's592')}` : '',
                overview: '',
                rating: m.scoring?.find(s => s.provider_type === 'imdb:score')?.value || 0,
                status
            };
        });
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/shows', async (req, res) => {
    try {
        const jwRes = await axios.post(JUSTWATCH_API, {
            content_types: ["show"], page: 1, page_size: 40
        }, { headers: { 'Content-Type': 'application/json' } });

        const sonarrUrl = process.env.SONARR_URL || 'http://sonarr:8989';
        const sonarrApiKey = process.env.SONARR_API_KEY;

        let sonarrShows = [];
        try {
            const sonarrRes = await axios.get(`${sonarrUrl}/api/v3/series`, { headers: { 'X-Api-Key': sonarrApiKey } });
            sonarrShows = sonarrRes.data || [];
        } catch (e) { }

        const results = jwRes.data.items.map(m => {
            const sMatch = sonarrShows.find(s => s.title.toLowerCase() === m.title.toLowerCase());
            let status = 'missing';
            if (sMatch) {
                status = sMatch.statistics?.percentOfEpisodes === 100 ? 'available' : 'downloading';
            }

            return {
                tmdbId: m.id,
                title: m.title,
                year: m.original_release_year || '',
                posterURL: m.poster ? `https://images.justwatch.com${m.poster.replace('{profile}', 's592')}` : '',
                overview: '',
                rating: m.scoring?.find(s => s.provider_type === 'imdb:score')?.value || 0,
                status
            };
        });
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/add', async (req, res) => {
    const { title, type } = req.body;
    if (!title || !type) return res.status(400).json({ error: 'title and type required' });

    try {
        if (!OMDB_API_KEY) return res.status(500).json({ error: 'OMDB API key not configured' });
        
        const imdbId = await getTmdbId(title, type);
        if (!imdbId) return res.status(404).json({ error: 'Could not find item on OMDB' });

        if (type === 'movie') {
            await addMovieToRadarr({ title, id: imdbId });
        } else if (type === 'tv') {
            await addShowToSonarr({ name: title }, imdbId);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Platform Trending Endpoint (Simplified via JustWatch) ───────────
router.get('/platform/:providerId/:type', async (req, res) => {
    const { type } = req.params;
    const mediaType = type === 'tv' ? 'show' : 'movie';

    try {
        const jwRes = await axios.post(JUSTWATCH_API, {
            content_types: [mediaType], page: 1, page_size: 20
        }, { headers: { 'Content-Type': 'application/json' } });

        const results = jwRes.data.items || [];
        res.json({ noApiKey: false, results: results.map(item => ({
            tmdbId: item.id,
            title: item.title,
            year: item.original_release_year || '',
            posterURL: item.poster ? `https://images.justwatch.com${item.poster.replace('{profile}', 's592')}` : '',
            rating: item.scoring?.find(s => s.provider_type === 'imdb:score')?.value || 0,
            status: 'missing'
        })) });
    } catch (e) {
        res.json({ noApiKey: false, results: [] });
    }
});

module.exports = router;

