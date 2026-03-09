// =============================================================================
//  MediaFlow · Languages.jsx – Audio & subtitle language preferences
// =============================================================================
import { useConfig } from '../hooks/useConfig.js';
import { showToast } from '../App.jsx';

const LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
];

function LangPill({ lang, selected, onToggle }) {
    return (
        <button
            className={`pill ${selected ? 'active' : ''}`}
            onClick={() => onToggle(lang.code)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
            <span>{lang.flag}</span>
            {lang.name}
        </button>
    );
}

function LangSection({ title, desc, selected, onToggle, onSelectAll, onClear }) {
    return (
        <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={onSelectAll}>All</button>
                    <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={onClear}>Clear</button>
                </div>
            </div>
            <div className="pill-group">
                {LANGUAGES.map((lang) => (
                    <LangPill key={lang.code} lang={lang} selected={selected.includes(lang.code)} onToggle={onToggle} />
                ))}
            </div>
            {selected.length > 0 && (
                <div style={{ marginTop: 'var(--spacing-sm)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Selected: {selected.map((c) => LANGUAGES.find((l) => l.code === c)?.name || c).join(', ')}
                </div>
            )}
        </div>
    );
}

export default function Languages() {
    const { config, loading, updateConfig, saveConfig, dirty } = useConfig();
    const langs = config?.languages || {};
    const audio = langs.audio || [];
    const subtitles = langs.subtitles || [];
    const animeMode = langs.animeMode || false;

    const toggleAudio = (code) => {
        const next = audio.includes(code) ? audio.filter((c) => c !== code) : [...audio, code];
        updateConfig({ languages: { ...langs, audio: next } });
    };

    const toggleSub = (code) => {
        const next = subtitles.includes(code) ? subtitles.filter((c) => c !== code) : [...subtitles, code];
        updateConfig({ languages: { ...langs, subtitles: next } });
    };

    const toggleAnimeMode = () => {
        updateConfig({ languages: { ...langs, animeMode: !animeMode } });
    };

    const allCodes = LANGUAGES.map((l) => l.code);

    const handleSave = async () => {
        const result = await saveConfig();
        if (result.success) showToast('Language preferences saved!', 'success');
        else showToast(`Failed to save: ${result.error}`, 'error');
    };

    if (loading) return <div className="empty-state"><div className="spinner" /><p>Loading...</p></div>;

    return (
        <div>
            <div className="page-header">
                <h2>Language Preferences</h2>
                <p>Select your preferred audio languages and subtitle languages</p>
            </div>

            <div className="card" style={{ marginBottom: 'var(--spacing-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px' }}>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🎌 Anime Mode
                        <span className="status-badge online" style={{ fontSize: '0.65rem', padding: '2px 6px', display: animeMode ? 'inline-block' : 'none' }}>ACTIVE</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Enable to prioritize Japanese Dual-Audio and English Subtitles for the dedicated Sonarr-Anime container.
                    </div>
                </div>
                <label className="switch">
                    <input type="checkbox" checked={animeMode} onChange={toggleAnimeMode} />
                    <span className="switch-track" />
                </label>
            </div>

            <LangSection
                title="🔊 Default Audio Languages"
                desc="Preferred audio tracks for general downloaded content"
                selected={audio}
                onToggle={toggleAudio}
                onSelectAll={() => updateConfig({ languages: { ...langs, audio: allCodes } })}
                onClear={() => updateConfig({ languages: { ...langs, audio: [] } })}
            />

            <LangSection
                title="💬 Default Subtitle Languages"
                desc="Subtitle language preferences for Bazarr and Jellyfin playback"
                selected={subtitles}
                onToggle={toggleSub}
                onSelectAll={() => updateConfig({ languages: { ...langs, subtitles: allCodes } })}
                onClear={() => updateConfig({ languages: { ...langs, subtitles: [] } })}
            />

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
