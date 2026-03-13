import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from './../App';

export default function YouTube() {
    const { user } = useAuth();
    const [url, setUrl] = useState('');
    const [format, setFormat] = useState('best');
    const [isPlaylist, setIsPlaylist] = useState(false);
    
    const [jobs, setJobs] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);

    const fetchData = async () => {
        try {
            const [jobsRes, filesRes] = await Promise.all([
                apiFetch('/api/youtube/status'),
                apiFetch('/api/youtube/files')
            ]);
            if (jobsRes.ok) setJobs(await jobsRes.json());
            if (filesRes.ok) setFiles(await filesRes.json());
        } catch (e) {
            console.error('Failed to fetch yt data', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const id = setInterval(fetchData, 3000); // Polling every 3s
        return () => clearInterval(id);
    }, []);

    const handleDownload = async (e) => {
        e.preventDefault();
        if (!url) {
            showToast('URL is required', 'error');
            return;
        }

        try {
            const res = await apiFetch('/api/youtube/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, format, isPlaylist })
            });
            if (res.ok) {
                showToast('Download Queued', 'success');
                setUrl('');
                fetchData();
            } else {
                showToast('Failed to queue download', 'error');
            }
        } catch (e) {
            showToast('Network error queuing download', 'error');
        }
    };

    const handleDelete = async (filename) => {
        if (!confirm(`Delete ${filename}?`)) return;
        try {
            const res = await apiFetch(`/api/youtube/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('File deleted', 'success');
                fetchData();
            } else {
                showToast('Delete failed', 'error');
            }
        } catch(e) {
            showToast('Delete error', 'error');
        }
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div className="page-header" style={{ marginBottom: '10px' }}>
                <h2>YouTube Downloader</h2>
                <p>Download videos or playlists using the integrated yt-dlp container</p>
            </div>

            <div className="card" style={{ padding: '20px' }}>
                <form onSubmit={handleDownload} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Video or Playlist URL</label>
                        <input
                            type="url"
                            className="form-input"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Format Category</label>
                            <select 
                                className="form-input" 
                                value={format} 
                                onChange={(e) => setFormat(e.target.value)}
                            >
                                <option value="best">Best Available</option>
                                <option value="1080p">1080p Max</option>
                                <option value="720p">720p Max</option>
                                <option value="audio">Audio Only (M4A)</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input 
                                    type="checkbox" 
                                    checked={isPlaylist} 
                                    onChange={(e) => setIsPlaylist(e.target.checked)} 
                                />
                                <span>Download as Playlist (if URL is a playlist)</span>
                            </label>
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                        📥 Start Download
                    </button>
                </form>
            </div>

            {/* Active Downloads */}
            <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>Active Downloads</h3>
                {loading && jobs.length === 0 ? (
                    <div className="spinner"></div>
                ) : jobs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)' }}>No active downloads.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {jobs.map(job => (
                            <div key={job.id} style={{ background: 'var(--bg-input)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '5px', wordBreak: 'break-all' }}>{job.title}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    <span>{job.status.toUpperCase()}</span>
                                    {job.status === 'downloading' && (
                                        <span>{job.speed} | ETA: {job.eta}</span>
                                    )}
                                </div>
                                <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${job.progress}%`, background: job.status === 'error' ? '#ef4444' : '#6366f1', transition: 'width 0.3s' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Downloaded Files */}
            <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>Downloaded Files ({files.length})</h3>
                <p style={{ margin: '0 0 15px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Files are saved to <code style={{ color: 'var(--accent-primary)' }}>/data/yt-downloads</code> on your server.
                </p>
                {loading && files.length === 0 ? (
                    <div className="spinner"></div>
                ) : files.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)' }}>No files downloaded yet.</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '10px 0' }}>Filename</th>
                                    <th>Size</th>
                                    <th>Date</th>
                                    {user?.role === 'admin' && <th style={{ textAlign: 'right' }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {files.map(f => (
                                    <tr key={f.name} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', background: selectedFile === f.name ? 'rgba(99,102,241,0.1)' : 'transparent' }}
                                        onClick={() => setSelectedFile(prev => prev === f.name ? null : f.name)}
                                    >
                                        <td style={{ padding: '12px 0', wordBreak: 'break-all', paddingRight: '15px', color: selectedFile === f.name ? 'var(--accent-primary)' : 'inherit' }}>▶ {f.name}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatBytes(f.size)}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(f.created).toLocaleDateString()}</td>
                                        {user?.role === 'admin' && (
                                            <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                                <button 
                                                    className="btn-icon" 
                                                    style={{ color: '#ef4444' }}
                                                    onClick={() => handleDelete(f.name)}
                                                    title="Delete file"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Video Preview Player */}
            {selectedFile && (
                <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>▶ Preview: {selectedFile}</h3>
                        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.85rem' }} onClick={() => setSelectedFile(null)}>✕ Close</button>
                    </div>
                    <video
                        key={selectedFile}
                        controls
                        autoPlay
                        style={{ width: '100%', maxHeight: '400px', borderRadius: '8px', background: '#000' }}
                    >
                        <source src={`/api/youtube/stream/${encodeURIComponent(selectedFile)}`} />
                        Your browser does not support the video tag.
                    </video>
                </div>
            )}

        </div>
    );
}
