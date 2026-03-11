export async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('mediaflow_token');
    return fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
}
