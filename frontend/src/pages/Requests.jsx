export default function Requests() {
    // Derive Jellyseerr URL assuming it is hosted on the same IP as the dashboard, port 5055.
    const host = window.location.hostname;
    const jellyseerrUrl = `http://${host}:5055`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            <iframe
                src={jellyseerrUrl}
                style={{ flexGrow: 1, border: 'none', width: '100%' }}
                title="Jellyseerr Requests"
            />
        </div>
    );
}
