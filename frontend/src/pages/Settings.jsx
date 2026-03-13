// =============================================================================
//  MediaFlow · Settings.jsx
// =============================================================================
import { useState, useEffect } from 'react';
import { useConfig } from '../hooks/useConfig';
import { showToast } from '../App';
import { Download, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function Settings() {
    const { config, updateConfig, loading } = useConfig();
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    const token = localStorage.getItem('mediaflow_token');

    const [updateInfo, setUpdateInfo] = useState(null);
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [startingUpdate, setStartingUpdate] = useState(false);

    const checkForUpdates = async (silent = false) => {
        if (!silent) setCheckingUpdate(true);
        try {
            const res = await apiFetch('/api/update/check');
            const data = await res.json();
            setUpdateInfo(data);
            if (!silent && !data.updateAvailable) {
                showToast('You are already on the latest version', 'info');
            }
        } catch (err) {
            if (!silent) showToast('Failed to check for updates', 'error');
        } finally {
            if (!silent) setCheckingUpdate(false);
        }
    };

    useEffect(() => {
        checkForUpdates(true);
        apiFetch('/api/update/history')
            .then(res => res.json())
            .then(data => setHistory(Array.isArray(data) ? data : []))
            .catch(err => console.error(err))
            .finally(() => setHistoryLoading(false));
    }, []);

    if (!token) return <div className="page-container"><div className="empty-state"><h2>Access Denied</h2></div></div>;
    if (loading) return <div className="page-container"><div className="spinner" style={{ margin: '0 auto' }} /></div>;

    const handleChannelChange = (e) => {
        const val = e.target.value;
        updateConfig('updateChannel', val);
        apiFetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updateChannel: val })
        }).then(() => {
            showToast('Update channel saved globally', 'success');
            checkForUpdates(true);
        }).catch(() => {
            showToast('Failed to save channel', 'error');
        });
    };

    const handleUpdateConfirm = async () => {
        if (!adminPassword) {
            showToast('Password is required', 'error');
            return;
        }
        setStartingUpdate(true);
        try {
            const res = await apiFetch('/api/update/verify-and-start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: adminPassword })
            });
            const data = await res.json();
            if (res.ok) {
                setPasswordModalOpen(false);
                setAdminPassword('');
                showToast('Update started!', 'success');
            } else {
                showToast(data.error || 'Failed to start update', 'error');
            }
        } catch (err) {
            showToast('Network error starting update', 'error');
        } finally {
            setStartingUpdate(false);
        }
    };


    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div className="page-header" style={{ marginBottom: '10px' }}>
                <h2>System Settings</h2>
                <p>Manage update channels and view system history</p>
            </div>

            {/* Updates Section */}
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: '0 0 5px 0' }}>System Updates</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Check for and install MediaFlow updates. Current Version: <strong style={{ color: 'var(--accent-primary)' }}>{updateInfo ? updateInfo.currentVersion : 'Checking...'}</strong>
                        </p>
                    </div>
                    <button className="btn btn-ghost" onClick={() => checkForUpdates(false)} disabled={checkingUpdate}>
                        <RefreshCw size={16} /> Check for Updates
                    </button>
                </div>

                {updateInfo && updateInfo.updateAvailable && (
                    <div style={{ marginTop: '10px', padding: '15px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent-primary)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div>
                                <h4 style={{ margin: 0, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Download size={18} /> Update Available: {updateInfo.latestVersion}
                                </h4>
                                <small style={{ color: 'var(--text-secondary)' }}>Released on: {new Date(updateInfo.publishedAt).toLocaleDateString()}</small>
                            </div>
                            <button className="btn btn-primary" onClick={() => setPasswordModalOpen(true)}>
                                Update Now
                            </button>
                        </div>
                        {updateInfo.changelog && (
                            <div style={{
                                marginTop: '10px',
                                padding: '10px',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '6px',
                                maxHeight: '150px',
                                overflowY: 'auto',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {updateInfo.changelog}
                            </div>
                        )}
                    </div>
                )}
            </div>


            <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: '0 0 5px 0' }}>Update Channel</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            Choose which updates MediaFlow will receive.
                        </p>
                    </div>
                    <div>
                        <select
                            value={config.updateChannel || 'stable'}
                            onChange={handleChannelChange}
                            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 w-full"
                            style={{ colorScheme: 'dark' }}
                        >
                            <option value="stable">Stable (Releases)</option>
                            <option value="beta">Beta (Main Branch)</option>
                        </select>
                    </div>
                </div>
                {config.updateChannel === 'beta' && (
                    <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#451a03', borderLeft: '4px solid #f59e0b', color: '#fcd34d', borderRadius: '4px', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: 'bold' }}>⚠ Warning:</span> Beta channel may contain unstable features.
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>Update History</h3>
                {historyLoading ? (
                    <div className="spinner" style={{ margin: '20px auto' }}></div>
                ) : history.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>No updates have been performed yet.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '12px 0' }}>Date</th>
                                    <th>Version Transition</th>
                                    <th>Result</th>
                                    <th>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Array.isArray(history) ? history : []).map((item, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px 0' }}>{new Date(item.timestamp).toLocaleString()}</td>
                                        <td>{item.previousVersion} ➔ {item.newVersion}</td>
                                        <td>
                                            <span style={{
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                                                backgroundColor: item.result === 'success' ? '#064e3b' : '#7f1d1d',
                                                color: item.result === 'success' ? '#34d399' : '#fca5a5'
                                            }}>
                                                {item.result.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>{item.duration}s</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Password Modal */}
            {passwordModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <h3>Confirm System Update</h3>
                            <button className="btn-icon" onClick={() => setPasswordModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', gap: '10px', padding: '12px', background: 'rgba(244, 63, 94, 0.1)', borderLeft: '3px solid var(--accent-rose)', borderRadius: '4px', marginBottom: '15px' }}>
                                <AlertTriangle size={20} color="var(--accent-rose)" />
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>This will restart all services. Enter your admin password to confirm:</p>
                            </div>
                            <input
                                type="password"
                                className="form-input"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                placeholder="Admin Password"
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '15px 20px', borderTop: '1px solid var(--color-border)' }}>
                            <button className="btn btn-ghost" onClick={() => setPasswordModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleUpdateConfirm} disabled={startingUpdate}>
                                {startingUpdate ? 'Verifying...' : 'Confirm Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
