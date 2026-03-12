import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../App';
import { apiFetch } from '../utils/api';
import { Edit2, Trash2, UserPlus, Shield, User, Eye, X } from 'lucide-react';

const AVATARS = [
    { id: 'film', emoji: '🎬' },
    { id: 'star', emoji: '⭐' },
    { id: 'rocket', emoji: '🚀' },
    { id: 'ghost', emoji: '👻' },
    { id: 'robot', emoji: '🤖' },
    { id: 'ninja', emoji: '🥷' },
    { id: 'alien', emoji: '👽' },
    { id: 'wizard', emoji: '🧙' },
    { id: 'dragon', emoji: '🐉' },
    { id: 'phoenix', emoji: '🦅' },
    { id: 'cat', emoji: '🐱' },
    { id: 'wolf', emoji: '🐺' },
];

const getAvatarEmoji = (avatarId) => {
    const found = AVATARS.find(a => a.id === avatarId);
    return found ? found.emoji : '🎬';
};

export default function Users() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
    const [editingUserId, setEditingUserId] = useState(null);

    const [form, setForm] = useState({
        displayName: '',
        username: '',
        password: '',
        role: 'viewer',
        avatar: 'film'
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await apiFetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else {
                showToast('Failed to fetch users', 'error');
            }
        } catch (err) {
            showToast('Network error loading users', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const url = modalMode === 'add' ? '/api/users' : `/api/users/${editingUserId}`;
        const method = modalMode === 'add' ? 'POST' : 'PUT';

        const payload = { ...form };
        if (modalMode === 'edit' && !payload.password) {
            delete payload.password;
        }

        try {
            const res = await apiFetch(url, {
                method,
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast(modalMode === 'add' ? 'User added successfully' : 'User updated', 'success');
                setModalOpen(false);
                fetchUsers();
            } else {
                const data = await res.json();
                showToast(data.error || 'Failed to save user', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    };

    const handleDelete = async (id, role) => {
        if (id === currentUser.id) {
            showToast('You cannot delete your own account', 'error');
            return;
        }

        if (role === 'admin' && users.filter(u => u.role === 'admin').length === 1) {
            showToast('Cannot delete the last admin account', 'error');
            return;
        }

        if (!window.confirm('Are you sure you want to delete this user?')) return;

        try {
            const res = await apiFetch(`/api/users/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showToast('User deleted', 'success');
                fetchUsers();
            } else {
                const data = await res.json();
                showToast(data.error || 'Failed to delete user', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    };

    const openModal = (mode, userObj = null) => {
        setModalMode(mode);
        if (mode === 'edit' && userObj) {
            setEditingUserId(userObj.id);
            setForm({
                displayName: userObj.displayName,
                username: userObj.username,
                password: '',
                role: userObj.role,
                avatar: userObj.avatar || 'film'
            });
        } else {
            setEditingUserId(null);
            setForm({ displayName: '', username: '', password: '', role: 'viewer', avatar: 'film' });
        }
        setModalOpen(true);
    };

    const roleColors = {
        admin: 'var(--accent-amber)',
        requester: 'var(--accent-primary)',
        viewer: 'var(--text-secondary)'
    };

    const roleIcons = {
        admin: <Shield size={14} />,
        requester: <User size={14} />,
        viewer: <Eye size={14} />
    };

    return (
        <div className="users-page fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>User Management</h2>
                    <p>Manage access to your MediaFlow dashboard</p>
                </div>
                <button className="btn btn-primary" onClick={() => openModal('add')}>
                    <UserPlus size={18} /> Add User
                </button>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto' }}></div></div>
            ) : (
                <div className="table-wrap card">
                    <table>
                        <thead>
                            <tr>
                                <th>Display Name</th>
                                <th>Username</th>
                                <th>Role</th>
                                <th>Created</th>
                                <th>Last Login</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td style={{ fontWeight: 600 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>{getAvatarEmoji(u.avatar)}</span>
                                            {u.displayName}
                                        </div>
                                    </td>
                                    <td><span style={{ opacity: 0.8, fontSize: '0.85rem' }}>@{u.username}</span></td>
                                    <td>
                                        <span className="status-badge" style={{ color: roleColors[u.role], borderColor: roleColors[u.role] }}>
                                            {roleIcons[u.role]} {u.role}
                                        </span>
                                    </td>
                                    <td><small>{new Date(u.createdAt).toLocaleDateString()}</small></td>
                                    <td><small>{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</small></td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div className="btn-group" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => openModal('edit', u)}>
                                                <Edit2 size={16} /> Edit
                                            </button>
                                            {u.id !== currentUser.id && (
                                                <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(u.id, u.role)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modalOpen && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <h3>{modalMode === 'add' ? 'Add New User' : 'Edit User'}</h3>
                            <button className="btn-icon" onClick={() => setModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="modal-body">
                            {/* Avatar Selector */}
                            <div className="form-group">
                                <label className="form-label">Avatar</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                                    {AVATARS.map(a => (
                                        <button
                                            key={a.id}
                                            type="button"
                                            onClick={() => setForm({ ...form, avatar: a.id })}
                                            style={{
                                                width: '42px', height: '42px', borderRadius: '50%',
                                                border: form.avatar === a.id ? '2px solid #8b5cf6' : '2px solid transparent',
                                                background: form.avatar === a.id ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
                                                cursor: 'pointer', fontSize: '20px', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                boxShadow: form.avatar === a.id ? '0 0 0 2px rgba(139,92,246,0.4)' : 'none',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            {a.emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Display Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={form.displayName}
                                    onChange={e => setForm({ ...form, displayName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={form.username}
                                    onChange={e => setForm({ ...form, username: e.target.value })}
                                    required
                                    disabled={modalMode === 'edit'}
                                    style={{ opacity: modalMode === 'edit' ? 0.6 : 1 }}
                                />
                                {modalMode === 'edit' && <small className="form-hint">Username cannot be changed.</small>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">{modalMode === 'add' ? 'Password' : 'New Password (leave blank to keep current)'}</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    required={modalMode === 'add'}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <select
                                    className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 w-full"
                                    style={{ colorScheme: 'dark' }}
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="requester">Requester</option>
                                    <option value="viewer">Viewer</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{modalMode === 'add' ? 'Add User' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
