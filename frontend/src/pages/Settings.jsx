// =============================================================================
//  MediaFlow · Settings.jsx
// =============================================================================
import { useState, useEffect } from 'react';
import useConfig from '../hooks/useConfig';
import { showToast } from '../App';

export default function Settings() {
    const { config, updateConfig, loading } = useConfig();
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    useEffect(() => {
        fetch('/api/update/history')
            .then(res => res.json())
            .then(data => setHistory(data))
            .catch(err => console.error(err))
            .finally(() => setHistoryLoading(false));
    }, []);

    if (loading) return <div className="page-container"><div className="spinner" style={{ margin: '0 auto' }} /></div>;

    const handleChannelChange = (e) => {
        const val = e.target.value;
        updateConfig('updateChannel', val);
        fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updateChannel: val })
        }).then(() => {
            showToast('Update channel saved globally', 'success');
        }).catch(() => {
            showToast('Failed to save channel', 'error');
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div className="page-header" style={{ marginBottom: '10px' }}>
                <h2>System Settings</h2>
                <p>Manage update channels and view system history</p>
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
                            style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
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
                                {history.map((item, i) => (
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
        </div>
    );
}
