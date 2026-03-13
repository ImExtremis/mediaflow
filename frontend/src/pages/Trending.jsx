import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from './../App';

const PLATFORMS = [
    { id: '8',   name: 'Netflix',         icon: '🔴' },
    { id: '119', name: 'Prime Video',      icon: '🔵' },
    { id: '122', name: 'Disney+ Hotstar',  icon: '🟣' },
    { id: '2',   name: 'Apple TV+',        icon: '⚪' }
];

// Reusable poster card
function PosterCard({ item, onAdd }) {
    return (
        <div style={{ minWidth: '150px', maxWidth: '150px', display: 'flex', flexDirection: 'column', flex: '0 0 auto', background: 'var(--bg-card)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ position: 'relative', aspectRatio: '2/3', background: '#222' }}>
                {item.posterURL ? (
                    <img src={item.posterURL} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '0.75rem' }}>No Image</div>
                )}
                <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    ⭐ {item.rating?.toFixed(1) || 'N/A'}
                </div>
            </div>
            <div style={{ padding: '8px', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.title}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.year}</div>
                <div style={{ marginTop: 'auto' }}>
                    {item.status === 'available' && (
                        <div style={{ background: '#059669', color: '#fff', textAlign: 'center', padding: '5px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 'bold' }}>Available</div>
                    )}
                    {item.status === 'downloading' && (
                        <div style={{ background: '#3b82f6', color: '#fff', textAlign: 'center', padding: '5px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 'bold' }}>Downloading</div>
                    )}
                    {item.status === 'missing' && (
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', padding: '5px', fontSize: '0.75rem' }}
                            onClick={() => onAdd(item.tmdbId)}
                        >
                            + Add
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Trending() {
    const { user } = useAuth();
    const [outerTab, setOuterTab] = useState('all');      // 'all' | 'platform'
    const [type, setType] = useState('movies');            // 'movies' | 'shows'
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusData, setStatusData] = useState(null);
    const [runningInfo, setRunningInfo] = useState({ lastRun: null, nextRun: null });
    const [noTmdbKey, setNoTmdbKey] = useState(false);

    // Platform section state: { [platformId]: { loading, noApiKey, movies: [], shows: [] } }
    const [platformData, setPlatformData] = useState({});

    const fetchItems = useCallback(async (currentType) => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/trending/${currentType}`);
            if (res.ok) {
                const data = await res.json();
                setItems(data);
                setNoTmdbKey(false);
            } else {
                const data = await res.json().catch(() => ({}));
                if (res.status === 500 && data?.error?.includes('TMDB API key')) {
                    setNoTmdbKey(true);
                    setItems([]);
                } else {
                    showToast('Failed to fetch trending', 'error');
                }
            }
        } catch (e) {
            console.error(e);
            showToast('Network error fetching trending', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

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

    const fetchPlatformSection = useCallback(async (platformId, mediaType) => {
        const key = `${platformId}_${mediaType}`;
        setPlatformData(prev => ({ ...prev, [key]: { ...(prev[key] || {}), loading: true } }));
        try {
            const res = await apiFetch(`/api/trending/platform/${platformId}/${mediaType}`);
            if (res.ok) {
                const data = await res.json();
                setPlatformData(prev => ({
                    ...prev,
                    [key]: { loading: false, noApiKey: data.noApiKey, results: data.results || [] }
                }));
            } else {
                setPlatformData(prev => ({ ...prev, [key]: { loading: false, noApiKey: false, results: [] } }));
            }
        } catch (e) {
            setPlatformData(prev => ({ ...prev, [key]: { loading: false, noApiKey: false, results: [] } }));
        }
    }, []);

    useEffect(() => {
        if (outerTab === 'all') {
            fetchItems(type);
            fetchStatus();
        }
    }, [type, outerTab, fetchItems]);

    useEffect(() => {
        if (outerTab === 'platform') {
            const mediaType = type === 'movies' ? 'movies' : 'tv';
            PLATFORMS.forEach(p => fetchPlatformSection(p.id, mediaType));
        }
    }, [outerTab, type, fetchPlatformSection]);

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
        // Optimistic UI for "all" tab
        setItems(prev => prev.map(i => i.tmdbId === tmdbId ? { ...i, status: 'downloading' } : i));
        // Optimistic UI for platform tabs
        setPlatformData(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                if (updated[key]?.results) {
                    updated[key] = {
                        ...updated[key],
                        results: updated[key].results.map(i => i.tmdbId === tmdbId ? { ...i, status: 'downloading' } : i)
                    };
                }
            });
            return updated;
        });

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
                fetchItems(type);
            }
        } catch (e) {
            showToast('Network error', 'error');
            fetchItems(type);
        }
    };

    const mediaType = type === 'movies' ? 'movies' : 'tv';

    // Check if TMDB key is missing (any platform returns noApiKey)
    const anyNoApiKey = Object.values(platformData).some(d => d?.noApiKey);

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Trending Content</h2>
                    <p>Discover and add popular movies and TV shows from TMDB</p>
                </div>
                {user?.role === 'admin' && outerTab === 'all' && (
                    <button className="btn btn-primary" onClick={handleRunNow}>
                        ⏵ Run Auto-Download Now
                    </button>
                )}
            </div>

            {/* Outer tab: All Trending / By Platform */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '5px', borderRadius: '12px' }}>
                    <button
                        className={`btn ${outerTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setOuterTab('all')}
                        style={{ margin: 0, borderRadius: '8px' }}
                    >
                        🌐 All Trending
                    </button>
                    <button
                        className={`btn ${outerTab === 'platform' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setOuterTab('platform')}
                        style={{ margin: 0, borderRadius: '8px' }}
                    >
                        📱 By Platform
                    </button>
                </div>

                {/* Movies / TV Shows inner tab */}
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

                {outerTab === 'all' && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Last auto-run: <strong>{runningInfo.lastRun}</strong> | Next: <strong>{runningInfo.nextRun}</strong>
                    </div>
                )}
            </div>

            {/* ── ALL TRENDING TAB ── */}
            {outerTab === 'all' && (
                loading ? (
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
                                            <div style={{ background: '#059669', color: '#fff', textAlign: 'center', padding: '8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>Available</div>
                                        )}
                                        {item.status === 'downloading' && (
                                            <div style={{ background: '#3b82f6', color: '#fff', textAlign: 'center', padding: '8px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>Downloading</div>
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
                            noTmdbKey ? (
                                <div style={{ gridColumn: '1 / -1', padding: '30px', textAlign: 'center', background: 'rgba(234,179,8,0.1)', border: '1px solid #eab308', borderRadius: '10px', color: '#eab308' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '12px' }}>🔑 TMDB API Key Required</div>
                                    <div style={{ marginBottom: '12px', lineHeight: 1.6 }}>
                                        To enable trending, get a free API key from{' '}
                                        <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" style={{ color: '#eab308' }}>themoviedb.org</a>{' '}
                                        and add it to your <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>.env</code> file:
                                    </div>
                                    <code style={{ display: 'block', background: 'rgba(0,0,0,0.4)', padding: '10px 16px', borderRadius: '6px', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                                        TMDB_API_KEY=your_key_here
                                    </code>
                                    <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Then restart the backend container: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>docker compose restart backend</code></div>
                                </div>
                            ) : (
                                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No trending {type} found.
                                </div>
                            )
                        )}
                    </div>
                )
            )}

            {/* ── BY PLATFORM TAB ── */}
            {outerTab === 'platform' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {anyNoApiKey && (
                        <div style={{ padding: '20px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', borderRadius: '10px', color: '#eab308', textAlign: 'center', fontWeight: 'bold' }}>
                            🔑 Add your TMDB API key to .env to enable trending
                        </div>
                    )}
                    {PLATFORMS.map(platform => {
                        const key = `${platform.id}_${mediaType}`;
                        const pData = platformData[key];
                        return (
                            <div key={platform.id}>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{platform.icon}</span> {platform.name}
                                </h3>
                                {!pData || pData.loading ? (
                                    <div className="spinner" style={{ margin: '0' }}></div>
                                ) : pData.noApiKey ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>TMDB API key required</div>
                                ) : pData.results?.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No content found for this platform.</div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                                        {pData.results.map(item => (
                                            <PosterCard key={item.tmdbId} item={item} onAdd={handleAdd} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
