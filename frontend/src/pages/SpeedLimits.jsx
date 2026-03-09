// =============================================================================
//  MediaFlow · SpeedLimits.jsx – Download & upload speed limit sliders
// =============================================================================
import { useState } from 'react';
import { useConfig } from '../hooks/useConfig.js';
import { showToast } from '../App.jsx';

const MAX_KB = 102400; // 100 MB/s

function formatSpeed(kbs) {
    if (kbs === 0) return 'Unlimited';
    if (kbs >= 1024) return `${(kbs / 1024).toFixed(1)} MB/s`;
    return `${kbs} KB/s`;
}

function SpeedSlider({ label, icon, value, onChange, desc }) {
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>{icon}</span>
                <div>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{desc}</div>
                </div>
            </div>

            <div className="slider-wrapper">
                <div className="slider-controls">
                    <input
                        type="range"
                        className="range-input"
                        min={0}
                        max={MAX_KB}
                        step={512}
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                    />
                    <div className="slider-value">{formatSpeed(value)}</div>
                </div>

                {/* Quick presets */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[0, 1024, 5120, 10240, 20480, 51200].map((preset) => (
                        <button
                            key={preset}
                            className={`pill ${value === preset ? 'active' : ''}`}
                            onClick={() => onChange(preset)}
                            style={{ fontSize: '0.75rem', padding: '5px 12px' }}
                        >
                            {formatSpeed(preset)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function SpeedLimits() {
    const { config, loading, updateConfig, saveConfig, dirty } = useConfig();
    const speed = config?.speed || {};

    const handleChange = (key, val) => {
        updateConfig({ speed: { [key]: val } });
    };

    const handleSave = async () => {
        const result = await saveConfig();
        if (result.success) showToast('Speed limits saved!', 'success');
        else showToast(`Failed to save: ${result.error}`, 'error');
    };

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

    return (
        <div>
            <div className="page-header">
                <h2>Speed Limits</h2>
                <p>Set download and upload bandwidth limits for qBittorrent. Set to 0 for unlimited.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                <SpeedSlider
                    label="Download Speed Limit"
                    icon="⬇️"
                    desc="Maximum download speed for all torrents"
                    value={speed.downloadLimit ?? 0}
                    onChange={(v) => handleChange('downloadLimit', v)}
                />
                <SpeedSlider
                    label="Upload Speed Limit"
                    icon="⬆️"
                    desc="Maximum upload speed (seeding)"
                    value={speed.uploadLimit ?? 0}
                    onChange={(v) => handleChange('uploadLimit', v)}
                />
            </div>

            <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>📊 Current Status</div>
                <div style={{ display: 'flex', gap: 'var(--spacing-xl)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Download</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{formatSpeed(speed.downloadLimit ?? 0)}</div>
                    </div>
                    <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upload</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{formatSpeed(speed.uploadLimit ?? 0)}</div>
                    </div>
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
