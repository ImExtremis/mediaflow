import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export default function Watch() {
    const [jellyfinStatus, setJellyfinStatus] = useState({ url: null, apiKey: null, loading: true });
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        apiFetch('/api/jellyfin/info')
            .then(res => res.json())
            .then(data => setJellyfinStatus({ ...data, loading: false }))
            .catch(() => setJellyfinStatus({ url: null, apiKey: null, loading: false }));
    }, []);

    const toggleFullscreen = () => {
        const elem = document.getElementById('jellyfin-iframe');
        if (!document.fullscreenElement) {
            elem?.requestFullscreen?.().catch(err => console.error(err));
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.();
            setIsFullscreen(false);
        }
    };

    if (jellyfinStatus.loading) {
        return <div className="page-container"><p>Loading player...</p></div>;
    }

    if (!jellyfinStatus.url) {
        return <div className="page-container"><p>Failed to load Jellyfin URL.</p></div>;
    }

    const iframeUrl = `${jellyfinStatus.url}?ApiKey=${jellyfinStatus.apiKey}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <div style={{ padding: '10px 20px', backgroundColor: 'var(--bg-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Watch (MediaFlow Player)</h2>
                <button onClick={toggleFullscreen} style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
            </div>
            <iframe
                id="jellyfin-iframe"
                src={iframeUrl}
                style={{ flexGrow: 1, border: 'none', width: '100%' }}
                title="Jellyfin"
                allowFullScreen
            />
        </div>
    );
}
