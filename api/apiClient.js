// Single HTTP client for the whole app. All requests to the backend go through apiRequest.
// The base URL comes from the EXPO_PUBLIC_API_URL environment variable (see .env.example).
const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 15000;

let authToken = null;

export class ApiError extends Error {
    constructor(message, { status = null, isNetwork = false, notConfigured = false, data = null } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.isNetwork = isNetwork;
        this.notConfigured = notConfigured;
        this.data = data;
    }
}

export const isApiConfigured = () => API_URL.length > 0;

// The token is set by AuthContext on login/restore and cleared on logout.
export const setAuthToken = (token) => {
    authToken = token || null;
};

export const hasAuthToken = () => authToken !== null;

const buildQuery = (query) => {
    if (!query) return '';
    const parts = Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    return parts.length ? `?${parts.join('&')}` : '';
};

const parseBody = async (response) => {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (error) {
        return text;
    }
};

export const apiRequest = async (method, path, { body, query, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
    if (!isApiConfigured()) {
        throw new ApiError('API URL is not configured. Set EXPO_PUBLIC_API_URL in the .env file.', { notConfigured: true });
    }

    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetch(`${API_URL}${path}${buildQuery(query)}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
    } catch (error) {
        const message = error.name === 'AbortError'
            ? 'The server did not respond in time.'
            : 'Could not reach the server.';
        throw new ApiError(message, { isNetwork: true });
    } finally {
        clearTimeout(timer);
    }

    const data = await parseBody(response);

    if (!response.ok) {
        const message = (data && typeof data === 'object' && data.message)
            || `Request failed with status ${response.status}.`;
        throw new ApiError(message, { status: response.status, data });
    }

    return data;
};

export const api = {
    get: (path, options) => apiRequest('GET', path, options),
    post: (path, body, options) => apiRequest('POST', path, { ...options, body }),
    put: (path, body, options) => apiRequest('PUT', path, { ...options, body }),
    delete: (path, options) => apiRequest('DELETE', path, options),
};
