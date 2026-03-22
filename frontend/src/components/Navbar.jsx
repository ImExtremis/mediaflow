import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function Navbar({ onHamburger }) {
    const { user, logout } = useAuth();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const location = useLocation();

    const getTitle = () => {
        const path = location.pathname;
        if (path === '/') return 'Dashboard';
        if (path === '/content') return 'Content Preferences';
        if (path === '/quality') return 'Quality Profiles';
        if (path === '/ratings') return 'Rating Filters';
        if (path === '/storage') return 'Storage Paths';
        if (path === '/speed') return 'Speed Limits';
        if (path === '/languages') return 'Languages';
        if (path === '/indexers') return 'Indexers';
        if (path === '/watch') return 'Watch';
        if (path === '/requests') return 'Requests';
        if (path === '/transcoding') return 'Transcoding';
        if (path === '/settings') return 'Settings';
        if (path === '/users') return 'User Management';
        return 'MediaFlow';
    };

    const roleColors = {
        admin: '#fbbf24',    // gold
        requester: '#60a5fa', // blue
        viewer: '#9ca3af'     // grey
    };

    return (
        <header className="navbar">
            <button className="hamburger" onClick={onHamburger}>
                <span></span>
                <span></span>
                <span></span>
            </button>
            <div className="navbar-logo">
                <img 
                    src="/logo.png" 
                    alt="MediaFlow" 
                    style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '8px',
                        objectFit: 'contain'
                    }} 
                />
                <h1>MediaFlow</h1>
            </div>

            <div className="navbar-center">
                <h2>{getTitle()}</h2>
            </div>

            <div className="navbar-right">
                <div className="user-profile" onClick={() => setDropdownOpen(!dropdownOpen)}>
                    <div className="user-info">
                        <span className="user-name">{user?.displayName || user?.username}</span>
                        <span
                            className="role-badge"
                            style={{
                                borderColor: roleColors[user?.role] || '#fff',
                                color: roleColors[user?.role] || '#fff',
                                backgroundColor: `${roleColors[user?.role]}15` // 15 represents ~0.08 alpha
                            }}
                        >
                            {user?.role}
                        </span>
                    </div>
                    <div className="user-avatar">
                        <User size={20} />
                    </div>

                    {dropdownOpen && (
                        <div className="user-dropdown">
                            <button className="dropdown-item">
                                <User size={16} /> Profile
                            </button>
                            <button className="dropdown-item" onClick={logout}>
                                <LogOut size={16} /> Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
