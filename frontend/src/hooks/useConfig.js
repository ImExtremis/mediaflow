// =============================================================================
//  MediaFlow · useConfig hook
//  Fetches and updates config.json via the backend API
// =============================================================================
import { useState, useEffect, useCallback } from 'react';

const API = '/api';

export function useConfig() {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dirty, setDirty] = useState(false);

    const fetchConfig = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API}/config`);
            const data = await res.json();
            setConfig(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const updateConfig = useCallback((partial) => {
        setConfig((prev) => deepMerge(prev, partial));
        setDirty(true);
    }, []);

    const saveConfig = useCallback(async () => {
        try {
            const res = await fetch(`${API}/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Save failed');
            setConfig(data.config);
            setDirty(false);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }, [config]);

    return { config, loading, error, dirty, updateConfig, saveConfig, refetch: fetchConfig };
}

function deepMerge(target = {}, source = {}) {
    const out = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            out[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            out[key] = source[key];
        }
    }
    return out;
}
