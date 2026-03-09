// =============================================================================
//  MediaFlow · App.jsx – Root layout with sidebar + route definitions
// =============================================================================
import { useState, useCallback } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';

import Dashboard from './pages/Dashboard.jsx';
import ContentPrefs from './pages/ContentPrefs.jsx';
import QualityProfiles from './pages/QualityProfiles.jsx';
import RatingFilters from './pages/RatingFilters.jsx';
import StoragePaths from './pages/StoragePaths.jsx';
import SpeedLimits from './pages/SpeedLimits.jsx';
import Languages from './pages/Languages.jsx';
import Indexers from './pages/Indexers.jsx';
import Watch from './pages/Watch.jsx';
import Requests from './pages/Requests.jsx';
import Transcoding from './pages/Transcoding.jsx';
import Settings from './pages/Settings.jsx';
import MaintenanceScreen from './components/MaintenanceScreen.jsx';
import UpdateOverlay from './components/UpdateOverlay.jsx';

const NAV = [
    {
        group: 'Overview', items: [
            { to: '/', icon: '🏠', label: 'Dashboard' },
        ]
    },
    {
        group: 'Content', items: [
            { to: '/content', icon: '🎭', label: 'Content Preferences' },
            { to: '/quality', icon: '✨', label: 'Quality Profiles' },
            { to: '/ratings', icon: '🏷️', label: 'Rating Filters' },
        ]
    },
    {
        group: 'Media', items: [
            { to: '/storage', icon: '💾', label: 'Storage Paths' },
            { to: '/speed', icon: '⚡', label: 'Speed Limits' },
            { to: '/languages', icon: '🌐', label: 'Languages' },
            { to: '/indexers', icon: '🔍', label: 'Indexers' },
        ]
    },
    {
        group: 'Playback & Services', items: [
            { to: '/watch', icon: '🎞️', label: 'Watch' },
            { to: '/requests', icon: '🎉', label: 'Requests' },
            { to: '/transcoding', icon: '🔄', label: 'Transcoding' },
        ]
    },
    {
        group: 'System', items: [
            { to: '/settings', icon: '⚙️', label: 'Settings' },
        ]
    }
];

// ─── Toast System ─────────────────────────────────────────────────────────────
let _toastSetter = null;
export function showToast(message, type = 'info') {
    if (_toastSetter) {
        const id = Date.now();
        _toastSetter((prev) => [...prev, { id, message, type }]);
        setTimeout(() => _toastSetter((prev) => prev.filter((t) => t.id !== id)), 4000);
    }
}

function ToastContainer() {
    const [toasts, setToasts] = useState([]);
    _toastSetter = setToasts;
    return (
        <div className="toast-container">
            {toasts.map((t) => (
                <div key={t.id} className={`toast ${t.type}`}>
                    <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
                    {t.message}
                </div>
            ))}
        </div>
    );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar() {
    const location = useLocation();
    const [version, setVersion] = useState('v1.2');

    useEffect(() => {
        fetch('/api/update/check')
            .then(res => res.json())
            .then(data => {
                if (data.currentVersion) setVersion(data.currentVersion);
            })
            .catch(() => { });
    }, []);

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <h1>MediaFlow</h1>
                <p>Media Automation Dashboard</p>
            </div>

            <nav className="sidebar-nav">
                {NAV.map((group) => (
                    <div key={group.group}>
                        <div className="nav-section-label">{group.group}</div>
                        {group.items.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {item.label}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                MediaFlow {version}
                <br />
                <a
                    href="https://github.com/ImExtremis/mediaflow.git"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-primary)', opacity: 0.8 }}
                >
                    GitHub
                </a>
            </div>
        </aside>
    );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
    return (
        <div className="app-layout">
            <MaintenanceScreen />
            <UpdateOverlay />
            <Sidebar />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/content" element={<ContentPrefs />} />
                    <Route path="/quality" element={<QualityProfiles />} />
                    <Route path="/ratings" element={<RatingFilters />} />
                    <Route path="/storage" element={<StoragePaths />} />
                    <Route path="/speed" element={<SpeedLimits />} />
                    <Route path="/languages" element={<Languages />} />
                    <Route path="/indexers" element={<Indexers />} />
                    <Route path="/watch" element={<Watch />} />
                    <Route path="/requests" element={<Requests />} />
                    <Route path="/transcoding" element={<Transcoding />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </main>
            <ToastContainer />
        </div>
    );
}
