const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const activeDownloads = new Map();

router.get('/status', (req, res) => {
    // Convert map to array properly format
    const jobs = Array.from(activeDownloads.values());
    res.json(jobs);
});

router.post('/download', (req, res) => {
    const { url, format, isPlaylist } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const jobId = Date.now().toString();
    const jobStatus = {
        id: jobId,
        url,
        status: 'starting',
        progress: 0,
        title: 'Fetching...',
        speed: '',
        eta: ''
    };
    
    activeDownloads.set(jobId, jobStatus);
    res.json({ success: true, jobId });

    // Format arg
    let formatArg = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
    if (format === 'audio') formatArg = 'bestaudio/best';
    else if (format === '1080p') formatArg = 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
    else if (format === '720p') formatArg = 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';

    // Build docker exec args
    const ytdlArgs = [
        'exec', '-i', 'mediaflow_ytdlp', 'yt-dlp',
        '--newline',
        '--no-colors',
        '-f', formatArg,
        '-o', '/downloads/%(title)s [%(format_id)s].%(ext)s',
    ];

    if (!isPlaylist) ytdlArgs.push('--no-playlist');
    else ytdlArgs.push('--yes-playlist');
    
    // Subtitles for audio are irrelevant, but typically skipped in basic setup
    ytdlArgs.push(url);

    const child = spawn('docker', ytdlArgs);

    let currentTitle = 'Downloading...';

    child.stdout.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n');
        
        for (const line of lines) {
            if (line.includes('[download] Destination:')) {
                // [download] Destination: /downloads/Video Title [format].mp4
                const match = line.match(/\/downloads\/(.+)$/);
                if (match) currentTitle = match[1];
                jobStatus.title = currentTitle;
            } else if (line.includes('[download]') && line.includes('%')) {
                // e.g. [download]  15.2% of  120.34MiB at    3.45MiB/s ETA 00:29
                const parts = line.replace(/\[download\]/g, '').trim().split(/\s+/);
                // Simple regex to extract common yt-dlp percent & eta
                const pctMatch = line.match(/(\d+\.\d+)%/);
                const spdMatch = line.match(/at\s+([~0-9\.a-zA-Z\/]+)/);
                const etaMatch = line.match(/ETA\s+([\d:]+)/);
                
                if (pctMatch) jobStatus.progress = parseFloat(pctMatch[1]);
                if (spdMatch) jobStatus.speed = spdMatch[1];
                if (etaMatch) jobStatus.eta = etaMatch[1];
                jobStatus.status = 'downloading';
            } else if (line.includes('[ExtractAudio] Destination:')) {
                const match = line.match(/\/downloads\/(.+)$/);
                if (match) currentTitle = match[1];
                jobStatus.title = currentTitle;
                jobStatus.status = 'processing';
            }
        }
        activeDownloads.set(jobId, jobStatus);
    });

    child.stderr.on('data', (data) => {
        console.log(`yt-dlp ERROR: ${data}`);
    });

    child.on('close', (code) => {
        jobStatus.progress = 100;
        jobStatus.status = code === 0 ? 'completed' : 'error';
        if (code !== 0) {
            jobStatus.title = `Error: Exit code ${code}`;
        } else if (currentTitle && currentTitle !== 'Downloading...') {
            // Fix 5: Link or copy to media/youtube for Jellyfin indexing
            const srcPath = path.join('/data/yt-downloads', currentTitle);
            const destDir = '/data/media/youtube';
            const destPath = path.join(destDir, currentTitle);
            
            try {
                if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
                // Attempt hardlink (fastest, saves space), fallback to copy
                try {
                    fs.linkSync(srcPath, destPath);
                } catch (linkErr) {
                    fs.copyFileSync(srcPath, destPath);
                }
            } catch (err) {
                console.error('[YouTube] Failed to move file to media dir:', err.message);
            }
        }
        activeDownloads.set(jobId, jobStatus);
        
        // Remove completed/errored jobs from active map after 15 minutes automatically to save memory
        setTimeout(() => activeDownloads.delete(jobId), 15 * 60 * 1000);
    });
});

router.get('/files', (req, res) => {
    // The backend container has /data mapped as ro
    const ytDir = '/data/yt-downloads';
    
    if (!fs.existsSync(ytDir)) return res.json([]);
    
    try {
        const files = fs.readdirSync(ytDir).map(file => {
            const stat = fs.statSync(path.join(ytDir, file));
            return {
                name: file,
                size: stat.size,
                created: stat.birthtime || stat.mtime
            };
        }).filter(f => !f.name.endsWith('.part') && !f.name.endsWith('.ytdl'));
        
        // Sort descending by created using birthtime
        files.sort((a,b) => b.created - a.created);
        
        res.json(files);
    } catch(e) {
        console.error('Error reading yt-downloads:', e);
        res.status(500).json({ error: 'Failed to list directory' });
    }
});

router.delete('/files/:filename', (req, res) => {
    if (req.user && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    const filename = req.params.filename;
    
    // We cannot delete natively because /data is ro config in backend mapping.
    // Instead we use docker exec on ytdlp container
    
    const child = spawn('docker', ['exec', 'mediaflow_ytdlp', 'rm', '-f', `/downloads/${filename}`]);
    child.on('close', (code) => {
        if (code === 0) res.json({ success: true });
        else res.status(500).json({ error: 'Delete failed' });
    });
});

router.get('/stream/:filename', (req, res) => {
    const filename = req.params.filename;
    // Basic path traversal protection
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join('/data/yt-downloads', filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
});

module.exports = router;

