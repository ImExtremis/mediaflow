import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../App';

export default function Setup() {
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { login, setupRequired } = useAuth();

    // If somehow landed here and setup isn't required, redirect
    if (!setupRequired) {
        navigate('/login');
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName, username, password })
            });

            const data = await res.json();
            if (res.ok) {
                login(data.token, data.user);
                showToast('Admin account created successfully!', 'success');
                // The checkAuth handles removing setupRequired state eventually
                // But navigating to / is safe as login state is set
                window.location.href = '/';
            } else {
                showToast(data.error || 'Setup failed', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card fade-in">
                <div className="auth-header" style={{ textAlign: 'center' }}>
                    <div className="flex justify-center mb-8">
                        <img
                            src="/mediaflow-logo.png"
                            alt="MediaFlow"
                            className="w-32 h-32 rounded-2xl object-contain"
                            style={{ filter: 'drop-shadow(0 0 20px rgba(139, 92, 246, 0.5))' }}
                        />
                    </div>
                    <h1>MediaFlow Setup</h1>
                    <p>Welcome! Let's configure your admin account.</p>
                </div>
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label className="form-label">Display Name</label>
                        <input
                            type="text"
                            className="form-input"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. John Doe"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="admin"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }} disabled={isLoading}>
                        {isLoading ? 'Creating...' : 'Create Admin Account'}
                    </button>
                </form>
            </div>
        </div>
    );
}
