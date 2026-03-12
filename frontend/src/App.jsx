// =============================================================================
//  MediaFlow · App.jsx – Root layout with sidebar + route definitions
// =============================================================================
import { useState, useEffect, useCallback } from 'react';
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
import Trending from './pages/Trending.jsx';
import YouTube from './pages/YouTube.jsx';
import Settings from './pages/Settings.jsx';
import Users from './pages/Users.jsx';
import MaintenanceScreen from './components/MaintenanceScreen.jsx';
import UpdateOverlay from './components/UpdateOverlay.jsx';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import Navbar from './components/Navbar.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';
import { apiFetch } from './utils/api';

const NAV = [
    {
        group: 'Overview', items: [
            { to: '/', icon: '🏠', label: 'Dashboard', color: '#ffffff' },
            { to: '/trending', icon: '🔥', label: 'Trending', color: '#ef4444' },
        ]
    },
    {
        group: 'Content', items: [
            { to: '/content', icon: '🎭', label: 'Content Preferences', color: '#6366f1' },
            { to: '/quality', icon: '✨', label: 'Quality Profiles', color: '#6366f1' },
            { to: '/ratings', icon: '🏷️', label: 'Rating Filters', color: '#6366f1' },
        ]
    },
    {
        group: 'Media', items: [
            { to: '/storage', icon: '💾', label: 'Storage Paths', color: '#6366f1' },
            { to: '/speed', icon: '⚡', label: 'Speed Limits', color: '#6366f1' },
            { to: '/languages', icon: '🌐', label: 'Languages', color: '#6366f1' },
            { to: '/indexers', icon: '🔍', label: 'Indexers', color: '#f97316' },
        ]
    },
    {
        group: 'Playback & Services', items: [
            { to: '/watch', icon: '🎞️', label: 'Watch', color: '#06b6d4' },
            { to: '/requests', icon: '🎉', label: 'Requests', color: '#14b8a6' },
            { to: '/youtube', icon: '📥', label: 'YouTube', color: '#ef4444' },
            { to: '/transcoding', icon: '🔄', label: 'Transcoding', color: '#6366f1' },
        ]
    },
    {
        group: 'System', items: [
            { to: '/users', icon: '👥', label: 'Users', color: '#eab308' },
            { to: '/settings', icon: '⚙️', label: 'Settings', color: '#9ca3af' },
        ]
    }
];

// ─── Route Guards ─────────────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }) {
    const { isAuthenticated, loading, setupRequired, user } = useAuth();
    if (loading) return <div className="app-layout"><div style={{ margin: 'auto' }} className="spinner"></div></div>;
    if (setupRequired) return <Navigate to="/setup" replace />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return <Navigate to="/watch" replace />;
    }

    return children;
}

function PublicOnlyRoute({ children }) {
    const { isAuthenticated, loading, setupRequired } = useAuth();
    const location = useLocation();

    if (loading) return <div className="app-layout"><div style={{ margin: 'auto' }} className="spinner"></div></div>;
    if (setupRequired && location.pathname !== '/setup') return <Navigate to="/setup" replace />;
    if (!setupRequired && location.pathname === '/setup') return <Navigate to="/login" replace />;
    if (isAuthenticated) return <Navigate to="/" replace />;
    return children;
}

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
    const { user, logout } = useAuth();
    const [version, setVersion] = useState('v1.4.0');
    // We'll optionally fetch backend version to ensure synceAuth();

    useEffect(() => {
        apiFetch('/api/update/check')
            .then(res => res.json())
            .then(data => {
                if (data.currentVersion) setVersion(data.currentVersion);
            })
            .catch(() => { });
    }, []);

    const filterNav = () => {
        if (!user) return [];
        if (user.role === 'admin') return NAV;

        return NAV.map(group => {
            let allowedItems = [];
            if (user.role === 'requester') {
                allowedItems = group.items.filter(item => ['/watch', '/requests', '/youtube'].includes(item.to));
            } else if (user.role === 'viewer') {
                allowedItems = group.items.filter(item => ['/watch'].includes(item.to));
            }
            return { ...group, items: allowedItems };
        }).filter(group => group.items.length > 0);
    };

    const filteredNav = filterNav();

    return (
        <aside className="sidebar">
            <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 4px 0 0' }}>
                <img
                    src="/mediaflow-logo.png"
                    alt="MediaFlow"
                    style={{
                        width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain',
                        filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6))'
                    }}
                />
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', letterSpacing: '0.02em' }}>
                        Media<span style={{
                            background: 'linear-gradient(to right, #a78bfa, #fb923c)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>Flow</span>
                    </h1>
                    <p style={{ margin: 0, fontSize: '0.75rem' }}>Dashboard</p>
                </div>
            </div>

            <nav className="sidebar-nav" style={{ paddingTop: '20px' }}>
                {filteredNav.map((group) => (
                    <div key={group.group}>
                        <div className="nav-section-label">{group.group}</div>
                        {group.items.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                style={{ '--item-color': item.color }}
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
        <div className="app-container">
            <MaintenanceScreen />
            <UpdateOverlay />
            <ToastContainer />
            <Routes>
                <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                <Route path="/setup" element={<PublicOnlyRoute><Setup /></PublicOnlyRoute>} />

                <Route path="/*" element={
                    <ProtectedRoute>
                        <Navbar />
                        <div className="app-layout">
                            <Sidebar />
                            <main className="main-content">
                                <Routes>
                                    <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'requester']}><Dashboard /></ProtectedRoute>} />
                                    <Route path="/content" element={<ProtectedRoute allowedRoles={['admin']}><ContentPrefs /></ProtectedRoute>} />
                                    <Route path="/quality" element={<ProtectedRoute allowedRoles={['admin']}><QualityProfiles /></ProtectedRoute>} />
                                    <Route path="/ratings" element={<ProtectedRoute allowedRoles={['admin']}><RatingFilters /></ProtectedRoute>} />
                                    <Route path="/storage" element={<ProtectedRoute allowedRoles={['admin']}><StoragePaths /></ProtectedRoute>} />
                                    <Route path="/speed" element={<ProtectedRoute allowedRoles={['admin']}><SpeedLimits /></ProtectedRoute>} />
                                    <Route path="/languages" element={<ProtectedRoute allowedRoles={['admin']}><Languages /></ProtectedRoute>} />
                                    <Route path="/indexers" element={<ProtectedRoute allowedRoles={['admin']}><Indexers /></ProtectedRoute>} />
                                    <Route path="/watch" element={<ProtectedRoute allowedRoles={['admin', 'requester', 'viewer']}><Watch /></ProtectedRoute>} />
                                    <Route path="/requests" element={<ProtectedRoute allowedRoles={['admin', 'requester']}><Requests /></ProtectedRoute>} />
                                    <Route path="/youtube" element={<ProtectedRoute allowedRoles={['admin', 'requester']}><YouTube /></ProtectedRoute>} />
                                    <Route path="/transcoding" element={<ProtectedRoute allowedRoles={['admin']}><Transcoding /></ProtectedRoute>} />
                                    <Route path="/trending" element={<ProtectedRoute allowedRoles={['admin', 'requester', 'viewer']}><Trending /></ProtectedRoute>} />
                                    <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>} />
                                    <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />
                                    {/* Catch-all: redirect unknown routes to /watch */}
                                    <Route path="*" element={<Navigate to="/watch" replace />} />
                                </Routes>
                            </main>
                        </div>
                    </ProtectedRoute>
                } />
            </Routes>
        </div>
    );
}
