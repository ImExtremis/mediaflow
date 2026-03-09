import { useState, useEffect, useCallback } from 'react';
// =============================================================================
//  MediaFlow · Dashboard.jsx – Service health overview
// =============================================================================

const SERVICES_META = {
    sonarr: { label: 'Sonarr', icon: '📺', color: '#35C5F4', port: '8989' },
    radarr: { label: 'Radarr', icon: '🎬', color: '#FFC230', port: '7878' },
    'sonarr-anime': { label: 'Sonarr-Anime', icon: '🎌', color: '#E11D48', port: '8990' },
    prowlarr: { label: 'Prowlarr', icon: '🔍', color: '#FF7B25', port: '9696' },
    qbittorrent: { label: 'qBittorrent', icon: '⬇️', color: '#6DC9F7', port: '8082' },
    jellyfin: { label: 'Jellyfin', icon: '🎞️', color: '#AA5CC3', port: '8096' },
    bazarr: { label: 'Bazarr', icon: '📝', color: '#8b5cf6', port: '6767' },
    overseerr: { label: 'Overseerr', icon: '🎉', color: '#f59e0b', port: '5055' },
    tdarr: { label: 'Tdarr', icon: '🔄', color: '#10b981', port: '8265' }
};

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024, dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function Dashboard() {
    const [healthState, setHealthState] = useState({ disk: {}, services: [], torrentStats: {}, queues: {} });
    const [loading, setLoading] = useState(true);

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch('/api/health-monitor');
            if (res.ok) {
                const data = await res.json();
                setHealthState(data);
            }
        } catch (err) {
            console.error('Failed to fetch health data', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        const id = setInterval(fetchHealth, 30000); // 30s polling
        return () => clearInterval(id);
    }, [fetchHealth]);

    if (loading) return <div className="page-container"><div className="spinner" style={{ margin: '0 auto' }} /></div>;

    const { disk, services, torrentStats, queues } = healthState;

    const isUnhealthyService = services.some(s => s.status !== 'healthy');
    const isDiskFull = disk && disk.usedPercent >= 90;
    const showGlobalAlert = isUnhealthyService || isDiskFull;

    const diskColor = disk?.usedPercent >= 90 ? '#ef4444' : disk?.usedPercent >= 80 ? '#eab308' : '#10b981';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div className="page-header" style={{ marginBottom: '10px' }}>
                <h2>Health Monitor</h2>
                <p>Live status of your entire MediaFlow stack</p>
            </div>

            {showGlobalAlert && (
                <div style={{ padding: '15px', backgroundColor: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', borderRadius: '8px', fontWeight: 'bold' }}>
                    🚨 GLOBAL ALERT: {isDiskFull ? 'Storage Space is critically low (>90%)!' : 'One or more containers are unhealthy/offline.'}
                </div>
            )}

            {/* Disk Space Panel */}
            <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>💾 Disk Space (/data)</h3>
                {!disk || disk.error ? <p>Unable to retrieve disk data</p> : (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                            <span>{formatBytes(disk.usedBytes)} Used</span>
                            <span>{formatBytes(disk.availableBytes)} Free ({formatBytes(disk.totalBytes)} Total)</span>
                        </div>
                        <div style={{ height: '12px', background: '#333', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${disk.usedPercent}%`, background: diskColor, transition: 'width 0.5s' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Speeds and Queues */}
            <div className="card-grid">
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>📈 Network & Downloads</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#10b981' }}>⬇ {formatBytes(torrentStats?.downloadSpeed || 0)}/s</span>
                        <span style={{ color: '#3b82f6' }}>⬆ {formatBytes(torrentStats?.uploadSpeed || 0)}/s</span>
                    </div>
                    <div>
                        <span style={{ fontSize: '0.9rem' }}>Active Downloads: {torrentStats?.activeDownloads || 0}</span>
                        {torrentStats?.activeDownloads > 0 && (
                            <div style={{ height: '6px', background: '#333', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                                <div className="indeterminate-progress" style={{ width: '100%', height: '100%', background: '#6DC9F7' }} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>⏳ Processing Queues</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                            <span>📺 Sonarr Queue</span>
                            <span style={{ fontWeight: 'bold' }}>{queues?.sonarr || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                            <span>🎌 Sonarr-Anime Queue</span>
                            <span style={{ fontWeight: 'bold' }}>{queues?.sonarrAnime || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                            <span>🎬 Radarr Queue</span>
                            <span style={{ fontWeight: 'bold' }}>{queues?.radarr || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Container Status grid */}
            <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>🐳 Container Status</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                    {Object.entries(SERVICES_META).map(([id, meta]) => {
                        const svc = services.find(s => s.id === id);
                        let badgeClass = 'stopped';
                        if (svc?.status === 'healthy') badgeClass = 'online';
                        else if (svc?.status === 'unhealthy') badgeClass = 'offline';

                        return (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-card-hover)', borderRadius: '8px', borderLeft: `4px solid ${meta.color}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{meta.icon}</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{meta.label}</span>
                                </div>
                                <span className={`status-badge ${badgeClass}`} style={{ marginLeft: '10px' }} title={svc?.error || ''}>
                                    <span className="status-dot" />
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
            <style>{`
                .indeterminate-progress {
                    animation: slide 2s linear infinite;
                    background-image: linear-gradient(90deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent);
                    background-size: 1rem 1rem;
                }
                @keyframes slide { from { background-position: 1rem 0; } to { background-position: 0 0; } }
            `}</style>
        </div>
    );
}
