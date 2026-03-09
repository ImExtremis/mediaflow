// =============================================================================
//  MediaFlow · ContentPrefs.jsx – Anime / Movies / TV / Documentaries toggles
// =============================================================================
import { useConfig } from '../hooks/useConfig.js';
import { showToast } from '../App.jsx';

const CONTENT_TYPES = [
    { key: 'anime', icon: '⛩️', label: 'Anime', desc: 'Japanese animated series & films' },
    { key: 'movies', icon: '🎬', label: 'Movies', desc: 'Feature-length films' },
    { key: 'tvShows', icon: '📺', label: 'TV Shows', desc: 'Episodic television series' },
    { key: 'documentaries', icon: '🎙️', label: 'Documentaries', desc: 'Non-fiction content' },
];

function ToggleCard({ item, enabled, onToggle }) {
    return (
        <div
            className={`toggle-card ${enabled ? 'active' : ''}`}
            onClick={() => onToggle(item.key, !enabled)}
            role="switch"
            aria-checked={enabled}
            tabIndex={0}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onToggle(item.key, !enabled)}
        >
            <div className="toggle-label">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
                    {item.label}
                </span>
                <small>{item.desc}</small>
            </div>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={enabled} onChange={(e) => onToggle(item.key, e.target.checked)} />
                <span className="switch-track" />
            </label>
        </div>
    );
}

export default function ContentPrefs() {
    const { config, loading, updateConfig, saveConfig, dirty } = useConfig();

    const handleToggle = (key, value) => {
        updateConfig({ content: { [key]: value } });
    };

    const handleSave = async () => {
        const result = await saveConfig();
        if (result.success) showToast('Content preferences saved!', 'success');
        else showToast(`Failed to save: ${result.error}`, 'error');
    };

    if (loading) {
        return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;
    }

    const content = config?.content || {};

    return (
        <div>
            <div className="page-header">
                <h2>Content Preferences</h2>
                <p>Choose which types of content MediaFlow should manage automatically</p>
            </div>

            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>Active Content Types</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {Object.entries(content).filter(([, v]) => v).map(([k]) =>
                            CONTENT_TYPES.find((c) => c.key === k)?.label
                        ).filter(Boolean).join(' · ') || 'None enabled'}
                    </div>
                </div>

                <div className="toggle-group">
                    {CONTENT_TYPES.map((item) => (
                        <ToggleCard
                            key={item.key}
                            item={item}
                            enabled={!!content[item.key]}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>
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
