// =============================================================================
//  MediaFlow · QualityProfiles.jsx – 480p / 720p / 1080p / 4K selection
// =============================================================================
import { useConfig } from '../hooks/useConfig.js';
import { showToast } from '../App.jsx';

const PROFILES = [
    {
        id: '480p',
        label: '480p',
        icon: '📱',
        sub: 'Standard Definition',
        bits: 1,
        size: '~700 MB / movie',
        color: 'var(--text-muted)',
    },
    {
        id: '720p',
        label: '720p',
        icon: '💻',
        sub: 'High Definition',
        bits: 2,
        size: '~2 GB / movie',
        color: 'var(--accent-cyan)',
    },
    {
        id: '1080p',
        label: '1080p',
        icon: '🖥️',
        sub: 'Full HD',
        bits: 3,
        size: '~8 GB / movie',
        color: 'var(--accent-primary)',
    },
    {
        id: '4K',
        label: '4K UHD',
        icon: '📺',
        sub: 'Ultra HD · HDR',
        bits: 4,
        size: '~25–80 GB / movie',
        color: 'var(--accent-amber)',
    },
];

function QualityBar({ level, max = 4, color }) {
    return (
        <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
            {Array.from({ length: max }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        height: 4,
                        flex: 1,
                        borderRadius: 2,
                        background: i < level ? color : 'rgba(255,255,255,0.08)',
                        transition: 'background 0.3s ease',
                    }}
                />
            ))}
        </div>
    );
}

function ProfileCard({ profile, selected, onToggle }) {
    return (
        <div
            className={`toggle-card ${selected ? 'active' : ''}`}
            onClick={() => onToggle(profile.id)}
            role="checkbox"
            aria-checked={selected}
            tabIndex={0}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onToggle(profile.id)}
            style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
        >
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem' }}>{profile.icon}</span>
                <label className="switch" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected} onChange={() => onToggle(profile.id)} />
                    <span className="switch-track" />
                </label>
            </div>
            <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: selected ? profile.color : 'var(--text-primary)' }}>
                    {profile.label}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{profile.sub}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{profile.size}</div>
            </div>
            <QualityBar level={selected ? profile.bits : 0} color={profile.color} />
        </div>
    );
}

export default function QualityProfiles() {
    const { config, loading, updateConfig, saveConfig, dirty } = useConfig();

    const selected = config?.quality?.profiles || [];

    const handleToggle = (id) => {
        const next = selected.includes(id)
            ? selected.filter((p) => p !== id)
            : [...selected, id];
        updateConfig({ quality: { profiles: next } });
    };

    const handleSave = async () => {
        const result = await saveConfig();
        if (result.success) showToast('Quality profiles saved!', 'success');
        else showToast(`Failed to save: ${result.error}`, 'error');
    };

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

    return (
        <div>
            <div className="page-header">
                <h2>Quality Profiles</h2>
                <p>Select which video quality profiles to download. Multiple selections allowed.</p>
            </div>

            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Selected:{' '}
                        <strong style={{ color: 'var(--accent-primary)' }}>
                            {selected.length ? selected.join(', ') : 'None'}
                        </strong>
                    </div>
                </div>
                <div className="toggle-group">
                    {PROFILES.map((p) => (
                        <ProfileCard
                            key={p.id}
                            profile={p}
                            selected={selected.includes(p.id)}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>
            </div>

            <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>💡 Tips</div>
                <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 2 }}>
                    <li><strong>1080p</strong> is the sweet spot for most setups</li>
                    <li><strong>4K</strong> requires HDR-capable display and fast network</li>
                    <li>Enable multiple profiles — Sonarr/Radarr will prefer the highest available</li>
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
