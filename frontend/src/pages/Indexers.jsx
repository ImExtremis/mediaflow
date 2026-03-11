// =============================================================================
//  MediaFlow · Indexers.jsx – Prowlarr indexer management
// =============================================================================
import { useState, useEffect, useCallback } from 'react';
import { showToast } from '../App.jsx';
import { apiFetch } from '../utils/api';

function IndexerRow({ indexer, onToggle }) {
    const enabled = indexer.enabled !== false;
    const categories = Array.isArray(indexer.categories) ? indexer.categories.join(', ') : '';
    const lastSync = indexer.lastSyncTime ? new Date(indexer.lastSyncTime).toLocaleString() : 'Never';

    return (
        <tr>
            <td>
                <div style={{ fontWeight: 500 }}>{indexer.name || 'Unknown'}</div>
            </td>
            <td>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {indexer.type || '—'}
                </span>
            </td>
            <td>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {categories || '—'}
                </span>
            </td>
            <td>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {lastSync}
                </span>
            </td>
            <td>
                <label className="switch">
                    <input type="checkbox" checked={enabled} onChange={() => onToggle(indexer.id, !enabled)} />
                    <span className="switch-track" />
                </label>
            </td>
            <td>
                <a
                    href={`http://${window.location.hostname}:9696`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                    Edit ↗
                </a>
            </td>
        </tr>
    );
}

export default function Indexers() {
    const [indexers, setIndexers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchIndexers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiFetch('/api/indexers');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // data may be an error object if Prowlarr isn't up yet
            if (Array.isArray(data)) {
                setIndexers(data);
                setError(null);
            } else if (data.error) {
                throw new Error(data.error);
            } else {
                setIndexers([]);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchIndexers(); }, [fetchIndexers]);

    const handleToggle = async (id, enabled) => {
        try {
            const res = await apiFetch(`/api/proxy/prowlarr/api/v1/indexer/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ enable: enabled }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(`Indexer ${enabled ? 'enabled' : 'disabled'}`, 'success');
            setIndexers((prev) => prev.map((i) => i.id === id ? { ...i, enabled } : i));
        } catch (err) {
            showToast(`Failed: ${err.message}`, 'error');
        }
    };

    const handleSyncAll = async () => {
        try {
            showToast('Triggering Prowlarr Sync...', 'info');
            const res = await apiFetch('/api/indexers/sync', { method: 'POST' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast('Sync triggered successfully!', 'success');
        } catch (err) {
            showToast(`Sync Failed: ${err.message}`, 'error');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h2>Indexer Management</h2>
                <p>Manage your Prowlarr indexers. Changes are applied directly to Prowlarr.</p>
            </div>

            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                <button className="btn btn-primary" onClick={() => window.open(`http://${window.location.hostname}:9696`, '_blank')}>
                    🔍 Open Prowlarr ↗
                </button>
                <button className="btn btn-primary" onClick={handleSyncAll}>
                    🔄 Sync All Apps
                </button>
                <button className="btn btn-ghost" onClick={fetchIndexers}>
                    🔄 Refresh
                </button>
            </div>

            {loading ? (
                <div className="empty-state"><div className="spinner" /><p>Loading indexers from Prowlarr...</p></div>
            ) : error ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="icon">⚠️</div>
                        <h3>Cannot reach Prowlarr</h3>
                        <p style={{ color: 'var(--accent-rose)' }}>{error}</p>
                        <p>Make sure Prowlarr is running and your API key is set in the .env file.</p>
                        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={fetchIndexers}>Retry</button>
                    </div>
                </div>
            ) : indexers.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="icon">🔍</div>
                        <h3>No indexers configured</h3>
                        <p>Add indexers in Prowlarr to see them here.</p>
                        <a
                            href={`http://${window.location.hostname}:9696`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary"
                            style={{ marginTop: 8 }}
                        >
                            Open Prowlarr ↗
                        </a>
                    </div>
                </div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Categories</th>
                                <th>Last Sync</th>
                                <th>Enabled</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {indexers.map((indexer) => (
                                <IndexerRow key={indexer.id} indexer={indexer} onToggle={handleToggle} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="card" style={{ marginTop: 'var(--spacing-lg)' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>💡 Indexer Tips</div>
                <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 2 }}>
                    <li>Add indexers in <strong>Prowlarr</strong>, then sync them to Sonarr & Radarr automatically</li>
                    <li>Use the <strong>Prowlarr sync</strong> feature to push indexers to all arr apps at once</li>
                    <li>Public indexers (Nyaa, RARBG mirrors) don't require API keys</li>
                    <li>Private trackers generally provide better download quality and speed</li>
                </ul>
            </div>
        </div>
    );
}
