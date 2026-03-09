// =============================================================================
//  MediaFlow · StoragePaths.jsx – Media & download path configuration
// =============================================================================
import { useState, useEffect } from 'react';
import { useConfig } from '../hooks/useConfig.js';
import { showToast } from '../App.jsx';

const PATH_FIELDS = [
    { key: 'mediaPath', label: 'Media Library Root', icon: '📁', placeholder: '/mnt/media', desc: 'Root directory for all media (shared with Sonarr & Radarr)' },
    { key: 'downloadPath', label: 'Download Directory', icon: '📥', placeholder: '/mnt/downloads', desc: 'Where qBittorrent saves completed downloads' },
    { key: 'sonarrPath', label: 'TV Shows Path', icon: '📺', placeholder: '/mnt/media/tv', desc: 'Sonarr library path for TV shows' },
    { key: 'radarrPath', label: 'Movies Path', icon: '🎬', placeholder: '/mnt/media/movies', desc: 'Radarr library path for movies' },
];

function PathCard({ field, value, onChange }) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.3rem' }}>{field.icon}</span>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{field.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{field.desc}</div>
                </div>
            </div>
            <input
                type="text"
                className="form-input"
                value={value || ''}
                placeholder={field.placeholder}
                onChange={(e) => onChange(field.key, e.target.value)}
            />
        </div>
    );
}

export default function StoragePaths() {
    const { config, loading, updateConfig, saveConfig, dirty } = useConfig();
    const [pathChecks, setPathChecks] = useState(null);

    useEffect(() => {
        fetch('/api/config/paths/check')
            .then(res => res.json())
            .then(data => {
                if (data.success) setPathChecks(data.checks);
            })
            .catch(err => console.error("Failed to check paths:", err));
    }, []);

    const handleChange = (key, value) => {
        updateConfig({ storage: { [key]: value } });
    };

    const handleSave = async () => {
        const result = await saveConfig();
        if (result.success) {
            showToast('Storage paths saved!', 'success');
            // Re-check after save
            fetch('/api/config/paths/check')
                .then(res => res.json())
                .then(data => { if (data.success) setPathChecks(data.checks); })
                .catch(err => console.error("Failed to check paths:", err));
        }
        else showToast(`Failed to save: ${result.error}`, 'error');
    };

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

    const storage = config?.storage || {};

    // Validation checks
    const misconfiguredPaths = Object.values(storage).filter(p => p && !p.startsWith('/data/'));
    const hasPermissionErrors = pathChecks && Object.values(pathChecks).some(c => !c.valid);

    return (
        <div>
            <div className="page-header">
                <h2>Storage Paths</h2>
                <p>Configure where MediaFlow stores your media and downloads</p>
            </div>

            {(misconfiguredPaths.length > 0 || hasPermissionErrors) && (
                <div className="card" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', marginBottom: 'var(--spacing-md)' }}>
                    <h3 style={{ color: 'rgb(239, 68, 68)', marginTop: 0 }}>⚠️ Storage Configuration Warning</h3>

                    {misconfiguredPaths.length > 0 && (
                        <p style={{ color: 'var(--text-secondary)', marginBottom: hasPermissionErrors ? 10 : 0 }}>
                            <strong>Bad Remote Path Mapping:</strong> Some paths do not begin with <code>/data/</code>.
                            For qBittorrent and the arr apps to communicate properly via Docker volumes, all paths MUST map inside the <code>/data</code> directory (e.g., <code>/data/torrents/complete</code>).
                        </p>
                    )}

                    {hasPermissionErrors && (
                        <div>
                            <p style={{ color: 'var(--text-secondary)' }}><strong>Permission Denied:</strong> The backend is unable to write to the following directories. Make sure the folders exist and are owned by PUID 1000.</p>
                            <ul style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                {Object.entries(pathChecks).filter(([_, check]) => !check.valid).map(([key, check]) => (
                                    <li key={key}><code>{storage[key]}</code>: {check.error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                {PATH_FIELDS.map((f) => (
                    <PathCard key={f.key} field={f} value={storage[f.key]} onChange={handleChange} />
                ))}
            </div>

            <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>💡 Path Tips</div>
                <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 2 }}>
                    <li>All paths should be <strong>absolute Linux paths</strong> as seen inside Docker containers</li>
                    <li>Ensure the host directories exist and are readable by UID <code>1000</code></li>
                    <li>Download and media paths should be on the <strong>same filesystem</strong> to enable fast hardlink moves</li>
                    <li>After changing paths, update the corresponding paths inside <strong>Sonarr</strong> and <strong>Radarr</strong> settings too</li>
                </ul>
            </div>

            {dirty && (
                <div className="save-bar">
                    <p>📝 You have unsaved changes</p>
                    <div className="btn-group">
                        <button className="btn btn-ghost" onClick={() => window.location.reload()}>Discard</button>
                        <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
                    </div>
                </div>
            )}
        </div>
    );
}
