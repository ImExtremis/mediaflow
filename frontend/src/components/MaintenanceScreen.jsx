import { useState, useEffect } from 'react';
// =============================================================================
//  MediaFlow · MaintenanceScreen.jsx
// =============================================================================

export default function MaintenanceScreen() {
    const [isMaintenance, setIsMaintenance] = useState(false);

    useEffect(() => {
        // Intercept global fetch requests
        const originalFetch = window.fetch;
        window.fetch = async function (...args) {
            try {
                const response = await originalFetch(...args);
                if (response.status === 503) {
                    setIsMaintenance(true);
                }
                return response;
            } catch (error) {
                throw error;
            }
        };

        let pollingInterval = null;
        if (isMaintenance) {
            pollingInterval = setInterval(async () => {
                try {
                    const res = await originalFetch('/health');
                    if (res.ok) {
                        window.location.reload();
                    }
                } catch (e) {
                    // Still down
                }
            }, 5000);
        }

        return () => {
            window.fetch = originalFetch;
            if (pollingInterval) clearInterval(pollingInterval);
        };
    }, [isMaintenance]);

    if (!isMaintenance) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.content}>
                <div className="spinner" style={{ margin: '0 auto 20px auto', width: '50px', height: '50px' }}></div>
                <h2>MediaFlow is updating</h2>
                <p style={{ color: 'var(--text-secondary)' }}>This usually takes 2 to 5 minutes. Please wait.</p>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        textAlign: 'center'
    },
    content: {
        padding: '40px',
        backgroundColor: '#111827',
        borderRadius: '12px',
        border: '1px solid #374151',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    }
};
