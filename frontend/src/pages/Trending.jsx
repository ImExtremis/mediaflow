import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from './../App';

export default function Trending() {
    const { user } = useAuth();
    const [type, setType] = useState('movies'); // 'movies' or 'shows'
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusData, setStatusData] = useState(null);
    const [runningInfo, setRunningInfo] = useState({ lastRun: null, nextRun: null });

    const fetchItems = async (currentType) => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/trending/${currentType}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data);
            } else {
                showToast('Failed to fetch trending', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Network error fetching trending', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchStatus = async () => {
        try {
            const res = await apiFetch('/api/trending/status');
            if (res.ok) {
                const data = await res.json();
                setStatusData(data);
                setRunningInfo({
                    lastRun: data.lastRunTime ? new Date(data.lastRunTime).toLocaleString() : 'Never',
                    nextRun: data.nextScheduledRun || 'Not scheduled'
                });
            }
        } catch (e) { }
    };

    useEffect(() => {
        fetchItems(type);
        fetchStatus();
    }, [type]);

    const handleRunNow = async () => {
        if (!confirm('Run auto-download job now? This will add up to 10 movies and 10 shows based on config.')) return;
        try {
            const res = await apiFetch('/api/trending/run-now', { method: 'POST' });
            if (res.ok) {
                showToast('Trending auto-download started', 'success');
                setTimeout(() => { fetchStatus(); fetchItems(type); }, 3000);
            } else {
                showToast('Failed to start job', 'error');
            }
        } catch (e) {
            showToast('Error', 'error');
        }
    };

    const handleAdd = async (tmdbId) => {
        // Optimistic UI update
        setItems(prev => prev.map(i => i.tmdbId === tmdbId ? { ...i, status: 'downloading' } : i));

        try {
            const res = await apiFetch('/api/trending/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tmdbId, type: type === 'movies' ? 'movie' : 'tv' })
            });
            if (res.ok) {
                showToast('Added successfully', 'success');
            } else {
                showToast('Failed to add item', 'error');
                fetchItems(type); // revert on error
            }
        } catch (e) {
            showToast('Network error', 'error');
            fetchItems(type);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Trending Content</h2>
                    <p>Discover and add popular movies and TV shows from TMDB</p>
                </div>
                {user?.role === 'admin' && (
                    <button className="btn btn-primary" onClick={handleRunNow}>
                        ⏵ Run Auto-Download Now
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '5px', borderRadius: '12px' }}>
                    <button
                        className={`btn ${type === 'movies' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setType('movies')}
                        style={{ margin: 0, borderRadius: '8px' }}
                    >
                        Movies
                    </button>
                    <button
                        className={`btn ${type === 'shows' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setType('shows')}
                        style={{ margin: 0, borderRadius: '8px' }}
                    >
                        TV Shows
                    </button>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Last auto-run: <strong>{runningInfo.lastRun}</strong> | Next scheduled: <strong>{runningInfo.nextRun}</strong>
                </div>
            </div>

            {loading ? (
                <div className="spinner" style={{ margin: '40px auto' }}></div>
            ) : (
                <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                    {items.map(item => (
                        <div key={item.tmdbId} className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ position: 'relative', aspectRatio: '2/3', background: '#222' }}>
                                {item.posterURL ? (
                                    <img src={item.posterURL} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No Image</div>
                                )}
                                <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    ⭐ {item.rating?.toFixed(1) || 'N/A'}
                                </div>
                            </div>
                            <div style={{ padding: '15px', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ fontSize: '1rem', fontWeight: 'bold', lineHeight: 1.2 }}>{item.title}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.year}</div>
                                <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                                    {item.status === 'available' && (
                                        <div style={{ background: '#059669', color: '#fff', textAlign: 'center', padding: '8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                            Available
                                        </div>
                                    )}
                                    {item.status === 'downloading' && (
                                        <div style={{ background: '#3b82f6', color: '#fff', textAlign: 'center', padding: '8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                            Downloading
                                        </div>
                                    )}
                                    {item.status === 'missing' && (
                                        <button
                                            className="btn btn-primary"
                                            style={{ width: '100%', justifyContent: 'center', padding: '8px' }}
                                            onClick={() => handleAdd(item.tmdbId)}
                                        >
                                            + Add
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && !loading && (
                        <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No trending {type} found. Check TMDB API key in .env.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
