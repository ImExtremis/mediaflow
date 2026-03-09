// =============================================================================
//  MediaFlow · RatingFilters.jsx – Content rating toggles (G, PG, PG-13, R, NR)
// =============================================================================
import { useConfig } from '../hooks/useConfig.js';
import { showToast } from '../App.jsx';

const RATINGS = [
    { id: 'G', icon: '👶', label: 'G', desc: 'General Audiences', color: 'var(--accent-emerald)' },
    { id: 'PG', icon: '👨‍👩‍👧', label: 'PG', desc: 'Parental Guidance', color: 'var(--accent-cyan)' },
    { id: 'PG-13', icon: '🧑', label: 'PG-13', desc: 'Parents Strongly Cautioned', color: 'var(--accent-primary)' },
    { id: 'R', icon: '🔞', label: 'R', desc: 'Restricted · 17+ with adult', color: 'var(--accent-amber)' },
    { id: 'NR', icon: '❓', label: 'NR', desc: 'Not Rated', color: 'var(--text-muted)' },
];

function RatingCard({ rating, enabled, onToggle }) {
    return (
        <div
            className={`toggle-card ${enabled ? 'active' : ''}`}
            onClick={() => onToggle(rating.id)}
            role="checkbox"
            aria-checked={enabled}
            tabIndex={0}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onToggle(rating.id)}
            style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
        >
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.6rem' }}>{rating.icon}</span>
                <label className="switch" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={enabled} onChange={() => onToggle(rating.id)} />
                    <span className="switch-track" />
                </label>
            </div>
            <div
                style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: enabled ? rating.color : 'var(--text-muted)',
                    letterSpacing: '-0.5px',
                }}
            >
                {rating.label}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{rating.desc}</div>
        </div>
    );
}

export default function RatingFilters() {
    const { config, loading, updateConfig, saveConfig, dirty } = useConfig();
    const allowed = config?.ratings?.allowed || [];

    const handleToggle = (id) => {
        const next = allowed.includes(id)
            ? allowed.filter((r) => r !== id)
            : [...allowed, id];
        updateConfig({ ratings: { allowed: next } });
    };

    const handleSave = async () => {
        const result = await saveConfig();
        if (result.success) showToast('Rating filters saved!', 'success');
        else showToast(`Failed to save: ${result.error}`, 'error');
    };

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

    return (
        <div>
            <div className="page-header">
                <h2>Content Rating Filters</h2>
                <p>Control which MPAA content ratings are allowed in your library</p>
            </div>

            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Allowed ratings:{' '}
                        <strong style={{ color: 'var(--accent-primary)' }}>
                            {allowed.length ? allowed.join(', ') : 'None'}
                        </strong>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            className="btn btn-ghost"
                            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                            onClick={() => updateConfig({ ratings: { allowed: RATINGS.map((r) => r.id) } })}
                        >
                            Allow All
                        </button>
                        <button
                            className="btn btn-ghost"
                            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                            onClick={() => updateConfig({ ratings: { allowed: [] } })}
                        >
                            Block All
                        </button>
                    </div>
                </div>

                <div className="toggle-group">
                    {RATINGS.map((r) => (
                        <RatingCard key={r.id} rating={r} enabled={allowed.includes(r.id)} onToggle={handleToggle} />
                    ))}
                </div>
            </div>

            <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>ℹ️ How Filtering Works</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7 }}>
                    MediaFlow applies these filters when adding content to Sonarr and Radarr.
                    Content with a blocked rating will be ignored during automatic search.
                    Existing content in your library is not affected.
                </p>
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
