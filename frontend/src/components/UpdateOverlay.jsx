// =============================================================================
//  MediaFlow · UpdateOverlay.jsx
// =============================================================================
import { useState, useEffect, useRef } from 'react';

export default function UpdateOverlay() {
    const [updateData, setUpdateData] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [logs, setLogs] = useState([]);
    const [updateStatus, setUpdateStatus] = useState('pending'); // pending, running, success, rollback
    const [newVersionInfo, setNewVersionInfo] = useState('');

    const terminalRef = useRef(null);

    useEffect(() => {
        // Only run check if we haven't snoozed recently
        const snoozeTime = localStorage.getItem('mediaflow_update_snooze');
        if (snoozeTime && Date.now() - parseInt(snoozeTime) < 24 * 60 * 60 * 1000) {
            return;
        }

        fetch('/api/update/check')
            .then(res => res.json())
            .then(data => {
                if (data.updateAvailable) {
                    setUpdateData(data);
                }
            })
            .catch(err => console.error("Update check failed", err));

        // Check if an update is already running
        fetch('/api/update/status')
            .then(res => res.json())
            .then(data => {
                if (data.updateInProgress) {
                    setUpdating(true);
                    setUpdateStatus('running');
                    startLogStream();
                }
            });
    }, []);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    const startLogStream = () => {
        const eventSource = new EventSource('/api/update/progress');
        eventSource.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.log) {
                setLogs(prev => [...prev, data.log]);
                if (data.log.includes('AUTO ROLLBACK')) {
                    setUpdateStatus('rollback');
                }
            }
            if (data.done) {
                eventSource.close();
                if (data.result && data.result.success) {
                    setUpdateStatus('success');
                } else if (data.result && !data.result.success) {
                    setUpdateStatus('rollback');
                }
            }
        };
        eventSource.onerror = () => {
            eventSource.close();
        };
    };

    const handleRemindLater = () => {
        localStorage.setItem('mediaflow_update_snooze', Date.now().toString());
        setShowModal(false);
        setUpdateData(null); // hide badge
    };

    const handleUpdateNow = () => {
        if (window.confirm("MediaFlow will restart during the update. Active downloads will resume automatically. Are you sure?")) {
            setUpdating(true);
            setUpdateStatus('running');
            setNewVersionInfo(updateData.latestVersion);
            setShowModal(false);

            fetch('/api/update/start', { method: 'POST' })
                .then(res => res.json())
                .then(() => {
                    startLogStream();
                })
                .catch(err => {
                    console.error(err);
                    setUpdateStatus('rollback');
                });
        }
    };

    if (updating) {
        return (
            <div style={styles.terminalOverlay}>
                <div style={styles.terminalHeader}>
                    <h2 style={{ color: updateStatus === 'rollback' ? '#ef4444' : '#fff' }}>
                        MediaFlow Update
                        {updateStatus === 'running' ? <span className="spinner" style={{ display: 'inline-block', width: '20px', height: '20px', marginLeft: '10px' }} /> : ''}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Status: {updateStatus === 'rollback' ? 'Rolling Back...' : (updateStatus === 'success' ? 'Completed' : 'Applying Updates...')}
                    </p>
                </div>
                <div style={styles.terminalWindow} ref={terminalRef}>
                    {logs.map((L, i) => <div key={i}>{L}</div>)}
                </div>
                {updateStatus === 'success' && (
                    <div style={styles.terminalFooter}>
                        <h3 style={{ color: '#10b981', margin: '0 0 15px 0' }}>✅ Update Complete! (Version {newVersionInfo})</h3>
                        <button className="btn primary" onClick={() => window.location.reload()}>Reload Dashboard</button>
                    </div>
                )}
                {updateStatus === 'rollback' && (
                    <div style={styles.terminalFooter}>
                        <h3 style={{ color: '#ef4444', margin: '0 0 15px 0' }}>❌ Update Failed. Rollback Complete.</h3>
                        <a href="/settings" style={{ color: '#6DC9F7', display: 'block', marginBottom: '15px' }}>View Update Log in Settings</a>
                        <button className="btn" onClick={() => window.location.reload()}>Reload Dashboard</button>
                    </div>
                )}
            </div>
        );
    }

    if (!updateData) return null;

    return (
        <>
            <div style={styles.badge} className="pulse-badge" onClick={() => setShowModal(true)}>
                <span>✨ Update Available: {updateData.latestVersion}</span>
            </div>

            {showModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <h2 style={{ margin: '0 0 15px 0' }}>Update MediaFlow</h2>
                        <div style={{ padding: '15px', background: 'var(--bg-body)', borderRadius: '8px', marginBottom: '15px' }}>
                            <p style={{ margin: '0 0 5px 0' }}><strong>Current:</strong> {updateData.currentVersion} ➔ <strong>New:</strong> {updateData.latestVersion}</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Published: {new Date(updateData.publishedAt).toLocaleString()}</p>
                        </div>
                        <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '20px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', whiteSpace: 'pre-wrap', fontSize: '0.9rem', border: '1px solid var(--border-color)' }}>
                            {updateData.changelog || 'No changelog provided.'}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={handleRemindLater} style={{ backgroundColor: '#374151', color: 'white', border: 'none' }}>Remind Me Later</button>
                            <button className="btn primary" onClick={handleUpdateNow} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none' }}>Update Now</button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .pulse-badge { animation: pulse 2s infinite; cursor: pointer; }
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
            `}</style>
        </>
    );
}

const styles = {
    badge: {
        position: 'fixed',
        top: '20px',
        right: '25px',
        background: '#3b82f6',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        fontWeight: 'bold',
        fontSize: '0.9rem',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(5px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalContent: {
        background: 'var(--bg-card)',
        padding: '30px',
        borderRadius: '12px',
        width: '550px',
        maxWidth: '90%',
        color: 'white',
        border: '1px solid var(--border-color)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
    },
    terminalOverlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#0f1219',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        padding: '40px'
    },
    terminalHeader: {
        marginBottom: '20px'
    },
    terminalWindow: {
        flex: 1,
        backgroundColor: '#000',
        color: '#d1d5db',
        fontFamily: 'Consolas, Monaco, monospace',
        padding: '20px',
        borderRadius: '8px',
        overflowY: 'auto',
        fontSize: '0.95rem',
        whiteSpace: 'pre-wrap',
        border: '1px solid #1f2937',
        lineHeight: 1.5,
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
    },
    terminalFooter: {
        marginTop: '20px',
        textAlign: 'center',
        background: '#1f2937',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #374151'
    }
};
