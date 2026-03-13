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

const TMDB_API_KEY = process.env.TMDB_API_KEY;

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

async function getTvdbId(tmdbId) {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        return res.data.tvdb_id;
    } catch (e) {
        console.error('Failed to get TVDB ID', e.message);
        return null;
    }
}

async function runTrendingJob() {
    if (!TMDB_API_KEY) {
        console.log('Trending job aborted: TMDB_API_KEY missing');
        return;
    }

    console.log('Starting Trending Content Download Job...');
    let addedCount = 0;

    // Movies
    if (config.source === 'both' || config.source === 'movie') {
        try {
            const res = await axios.get(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`);
            const movies = res.data.results || [];
            let processed = 0;

            for (const movie of movies) {
                if (processed >= config.maxMovies) break;

                const exists = await checkRadarrExists(movie.id);
                if (exists) {
                    logAction(movie.title, false, true);
                } else {
                    const success = await addMovieToRadarr(movie);
                    logAction(movie.title, success, false);
                    if (success) addedCount++;
                }
                processed++;
            }
        } catch (e) {
            console.error('Failed to fetch trending movies', e.message);
        }
    }

    // TV
    if (config.source === 'both' || config.source === 'tv') {
        try {
            const res = await axios.get(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}`);
            const shows = res.data.results || [];
            let processed = 0;

            for (const show of shows) {
                if (processed >= config.maxShows) break;

                const tvdbId = await getTvdbId(show.id);
                if (!tvdbId) continue;

                const exists = await checkSonarrExists(tvdbId);
                if (exists) {
                    logAction(show.name, false, true);
                } else {
                    const success = await addShowToSonarr(show, tvdbId);
                    logAction(show.name, success, false);
                    if (success) addedCount++;
                }
                processed++;
            }
        } catch (e) {
            console.error('Failed to fetch trending shows', e.message);
        }
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
    if (!TMDB_API_KEY) return res.status(500).json({ error: 'TMDB API key not configured' });
    try {
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_API_KEY}`);
        const radarrUrl = process.env.RADARR_URL || 'http://radarr:7878';
        const radarrApiKey = process.env.RADARR_API_KEY;

        let radarrMovies = [];
        try {
            const radarrRes = await axios.get(`${radarrUrl}/api/v3/movie`, { headers: { 'X-Api-Key': radarrApiKey } });
            radarrMovies = radarrRes.data || [];
        } catch (e) { }

        const mapped = tmdbRes.data.results.map(m => {
            const rMatch = radarrMovies.find(rm => rm.tmdbId === m.id);
            let status = 'missing';
            if (rMatch) {
                status = rMatch.hasFile ? 'available' : 'downloading';
            }
            return {
                tmdbId: m.id,
                title: m.title,
                year: m.release_date ? m.release_date.substring(0, 4) : '',
                posterURL: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
                overview: m.overview,
                rating: m.vote_average,
                status
            };
        });
        res.json(mapped);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/shows', async (req, res) => {
    if (!TMDB_API_KEY) return res.status(500).json({ error: 'TMDB API key not configured' });
    try {
        const tmdbRes = await axios.get(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}`);
        const sonarrUrl = process.env.SONARR_URL || 'http://sonarr:8989';
        const sonarrApiKey = process.env.SONARR_API_KEY;

        let sonarrShows = [];
        try {
            const sonarrRes = await axios.get(`${sonarrUrl}/api/v3/series`, { headers: { 'X-Api-Key': sonarrApiKey } });
            sonarrShows = sonarrRes.data || [];
        } catch (e) { }

        const results = [];
        for (const m of tmdbRes.data.results) {
            let status = 'missing';
            // It's slow to do TVDB lookup for every item in list, let's just attempt to match by title as fallback
            // for the UI, or just TVDB if possible. 
            // In a real scenario we'd query TVDB IDs for all, but for UI mapping we can do a naive name match 
            // to avoid 20 consecutive API calls if not strictly needed, OR we just do them fast:
            const sMatch = sonarrShows.find(s => s.title.toLowerCase() === m.name.toLowerCase());

            if (sMatch) {
                status = sMatch.statistics?.percentOfEpisodes === 100 ? 'available' : 'downloading';
            }

            results.push({
                tmdbId: m.id,
                title: m.name,
                year: m.first_air_date ? m.first_air_date.substring(0, 4) : '',
                posterURL: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
                overview: m.overview,
                rating: m.vote_average,
                status
            });
        }
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/add', async (req, res) => {
    const { tmdbId, type } = req.body;
    if (!tmdbId || !type) return res.status(400).json({ error: 'tmdbId and type required' });

    try {
        if (type === 'movie') {
            const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`);
            await addMovieToRadarr(tmdbRes.data);
        } else if (type === 'tv') {
            const tmdbRes = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}`);
            const tvdbId = await getTvdbId(tmdbId);
            if (tvdbId) {
                await addShowToSonarr(tmdbRes.data, tvdbId);
            } else {
                return res.status(500).json({ error: 'Could not resolve TVDB ID' });
            }
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Platform Trending Endpoint ──────────────────────────────────────────────
// Provider IDs for India (watch_region=IN):
//   Netflix=8, Amazon Prime=119, Disney+ Hotstar=122, Apple TV+=2
router.get('/platform/:providerId/:type', async (req, res) => {
    if (!TMDB_API_KEY) {
        return res.json({ noApiKey: true, results: [] });
    }

    const { providerId, type } = req.params;
    const mediaType = type === 'tv' ? 'tv' : 'movie';

    try {
        const tmdbRes = await axios.get(
            `https://api.themoviedb.org/3/discover/${mediaType}`,
            {
                params: {
                    api_key: TMDB_API_KEY,
                    with_watch_providers: providerId,
                    watch_region: 'IN',
                    sort_by: 'popularity.desc',
                    page: 1
                }
            }
        );

        const results = (tmdbRes.data.results || []).slice(0, 20);

        let existingItems = [];
        if (mediaType === 'movie') {
            const radarrUrl = process.env.RADARR_URL || 'http://radarr:7878';
            const radarrApiKey = process.env.RADARR_API_KEY;
            try {
                const r = await axios.get(`${radarrUrl}/api/v3/movie`, { headers: { 'X-Api-Key': radarrApiKey } });
                existingItems = r.data || [];
            } catch (e) {}
        } else {
            const sonarrUrl = process.env.SONARR_URL || 'http://sonarr:8989';
            const sonarrApiKey = process.env.SONARR_API_KEY;
            try {
                const r = await axios.get(`${sonarrUrl}/api/v3/series`, { headers: { 'X-Api-Key': sonarrApiKey } });
                existingItems = r.data || [];
            } catch (e) {}
        }

        const mapped = results.map(item => {
            let status = 'missing';
            if (mediaType === 'movie') {
                const match = existingItems.find(m => m.tmdbId === item.id);
                if (match) status = match.hasFile ? 'available' : 'downloading';
            } else {
                const match = existingItems.find(s => s.title.toLowerCase() === (item.name || '').toLowerCase());
                if (match) status = match.statistics?.percentOfEpisodes === 100 ? 'available' : 'downloading';
            }
            return {
                tmdbId: item.id,
                title: item.title || item.name,
                year: (item.release_date || item.first_air_date || '').substring(0, 4),
                posterURL: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
                rating: item.vote_average,
                status
            };
        });

        res.json({ noApiKey: false, results: mapped });
    } catch (e) {
        console.error('Platform trending fetch failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;

