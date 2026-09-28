const runtimeApiUrl = (() => {
  if (!globalThis.window) return '';
  if (typeof globalThis.__API_URL__ === 'string' && globalThis.__API_URL__) return globalThis.__API_URL__;
  const q = new URLSearchParams(globalThis.window.location.search || '');
  return q.get('apiUrl') || '';
})();

let BASE = runtimeApiUrl || import.meta.env.VITE_API_URL || '/api';
if (globalThis.window?.location.protocol === 'file:' && BASE.startsWith('/')) {
  BASE = 'http://localhost:5000/api';
}

let pendingRequests = 0;
let lastError = '';
const listeners = new Set();

const emitRequestState = () => {
  const payload = { pendingRequests, lastError };
  listeners.forEach((listener) => {
    listener(payload);
  });
};

export const apiRequestState = {
  subscribe(listener) {
    listeners.add(listener);
    listener({ pendingRequests, lastError });
    return () => listeners.delete(listener);
  },
  clearError() {
    lastError = '';
    emitRequestState();
  },
};

let refreshingPromise = null;

const normalizeLanguage = (candidate) => {
  const lang = String(candidate || '').trim().toLowerCase();
  if (!lang) return 'en';
  if (lang.startsWith('ar')) return 'ar';
  return 'en';
};

const getPreferredLanguage = () => {
  if (!globalThis.window) return 'en';
  const saved = localStorage.getItem('lang') || localStorage.getItem('language') || localStorage.getItem('app_lang');
  if (saved) return normalizeLanguage(saved);
  return normalizeLanguage(globalThis.window.navigator?.language || 'en');
};

export const setApiLanguage = (lang) => {
  if (!globalThis.window) return;
  localStorage.setItem('lang', normalizeLanguage(lang));
};

export const setAuthTokens = ({ token, refreshToken }) => {
  if (token) localStorage.setItem('token', token);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
};

const clearAuthTokens = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
};

const shouldAttemptRefresh = (path) => !['/auth/login', '/auth/register', '/auth/refresh'].includes(path);

const refreshAccessToken = async () => {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('Session expired');
    const lang = getPreferredLanguage();

    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': lang,
        'X-Lang': lang,
      },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.token) {
      clearAuthTokens();
      throw new Error(data.error || 'Session expired');
    }

    setAuthTokens({ token: data.token, refreshToken: data.refreshToken });
    return data.token;
  })();

  try {
    return await refreshingPromise;
  } finally {
    refreshingPromise = null;
  }
};

const doFetch = async (method, path, body) => {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const lang = getPreferredLanguage();
  const headers = isFormData
    ? { 'Accept-Language': lang, 'X-Lang': lang }
    : { 'Content-Type': 'application/json', 'Accept-Language': lang, 'X-Lang': lang };
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;

  // Sensitive-action endpoints that require admin password re-confirmation via
  // header + query param. This must NEVER include auth routes (/auth/login,
  // /auth/register) — those send password exclusively in the JSON body.
  const CONFIRM_PASSWORD_PATHS = ['/sales/', '/production-orders/'];
  const needsConfirmPassword =
    body && typeof body === 'object' && body.password &&
    method === 'DELETE' &&
    CONFIRM_PASSWORD_PATHS.some((p) => path.includes(p));

  let finalPath = path;
  if (needsConfirmPassword) {
    headers['X-Confirm-Password'] = body.password;
    if (!finalPath.includes('password=')) {
      const sep = finalPath.includes('?') ? '&' : '?';
      finalPath = `${finalPath}${sep}password=${encodeURIComponent(body.password)}`;
    }
  }

  let payload;
  if (!body) payload = undefined;
  else if (isFormData) payload = body;
  else payload = JSON.stringify(body);

  return fetch(`${BASE}${finalPath}`, {
    method,
    headers,
    credentials: 'include',
    body: payload,
  });
};

const getApiOrigin = () => {
  if (!globalThis.window) return '';

  if (BASE.startsWith('http://') || BASE.startsWith('https://')) {
    if (URL.canParse(BASE)) return new URL(BASE).origin;
    return globalThis.window.location.origin;
  }

  if (globalThis.window.location.hostname === 'localhost' && globalThis.window.location.port === '3000') {
    return 'http://localhost:5000';
  }

  return globalThis.window.location.origin;
};

export const resolveApiAssetUrl = (assetPath) => {
  if (!assetPath) return '';
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) return assetPath;
  const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  // Remap legacy public path to the new authenticated API route
  const apiPath = normalized.startsWith('/uploads/')
    ? `/api${normalized}`
    : normalized;
  return `${getApiOrigin()}${apiPath}`;
};

const request = async (method, path, body) => {
  pendingRequests += 1;
  emitRequestState();

  try {
    let res = await doFetch(method, path, body);
    let data = await res.json().catch(() => ({}));

    if (res.status === 401 && shouldAttemptRefresh(path)) {
      try {
        await refreshAccessToken();
        res = await doFetch(method, path, body);
        data = await res.json().catch(() => ({}));
      } catch (refreshErr) {
        clearAuthTokens();
        console.warn('Access token refresh failed:', refreshErr?.message || refreshErr);
      }
    }

    if (!res.ok) {
      const message = data.error || `HTTP ${res.status}`;
      lastError = message;
      emitRequestState();
      throw new Error(message);
    }

    if (lastError) {
      lastError = '';
      emitRequestState();
    }

    return data;
  } finally {
    pendingRequests = Math.max(0, pendingRequests - 1);
    emitRequestState();
  }
};

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  delete: (path, body)   => request('DELETE', path, body),
};

export default api;
