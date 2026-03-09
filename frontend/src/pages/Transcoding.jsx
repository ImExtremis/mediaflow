export default function Transcoding() {
    // Derive Tdarr URL assuming it is hosted on the same IP as the dashboard, port 8265.
    const host = window.location.hostname;
    const tdarrUrl = `http://${host}:8265`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <iframe
                src={tdarrUrl}
                style={{ flexGrow: 1, border: 'none', width: '100%' }}
                title="Tdarr Transcoding"
            />
        </div>
    );
}
