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

const setAuthTokens = ({ token, refreshToken }) => {
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
  let payload;
  if (!body) payload = undefined;
  else if (isFormData) payload = body;
  else payload = JSON.stringify(body);

  return fetch(`${BASE}${path}`, {
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
  delete: (path)         => request('DELETE', path),
};

// Auth
export const authApi = {
  login:    async (body) => {
    const data = await api.post('/auth/login', body);
    setAuthTokens(data || {});
    return data;
  },
  register: async (body) => {
    const data = await api.post('/auth/register', body);
    setAuthTokens(data || {});
    return data;
  },
  refresh:  (body) => api.post('/auth/refresh', body),
  me:       ()     => api.get('/auth/me'),
  logout:   (body) => api.post('/auth/logout', body),
};

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
};

// Inventory
export const inventoryApi = {
  // Returns the data array directly; defaults to limit=1000 to fetch all records
  list:   (params = '?limit=1000') => api.get(`/inventory${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  get:    (id)          => api.get(`/inventory/${id}`),
  create: (body)        => api.post('/inventory', body),
  update: (id, body)    => api.put(`/inventory/${id}`, body),
  delete: (id)          => api.delete(`/inventory/${id}`),
};

// Employees
export const employeeApi = {
  departments:   ()        => api.get('/departments').then(r => {
    if (Array.isArray(r?.data)) return r.data;
    if (Array.isArray(r)) return r;
    return [];
  }),
  // Returns the data array directly; defaults to limit=1000 to fetch all records
  list:          (params = '?limit=1000') => api.get(`/employees${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  get:           (id)      => api.get(`/employees/${id}`),
  create:        (body)    => api.post('/employees', body),
  update:        (id, body)=> api.put(`/employees/${id}`, body),
  delete:        (id)      => api.delete(`/employees/${id}`),
  logAttendance: (id, body)=> api.post(`/employees/${id}/attendance`, body),
  attendance:    (id, q)   => api.get(`/employees/${id}/attendance${q || ''}`),
};

// Payroll
export const payrollApi = {
  list:   (params = '?limit=1000') => api.get(`/payroll${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  create: (body)        => api.post('/payroll', body),
  pay:    (id)          => api.put(`/payroll/${id}/pay`),
};

// Sales
export const salesApi = {
  customers:      (params = '?limit=1000') => api.get(`/customers${params}`).then(r => {
    if (Array.isArray(r?.data)) return r.data;
    if (Array.isArray(r)) return r;
    return [];
  }),
  customerLedger: (id)      => api.get(`/customers/${id}/ledger`),
  addPayment:     (id, body)=> api.post(`/customers/${id}/payments`, body),
  createCustomer: (body)    => api.post('/customers', body),
  // Returns the data array directly; defaults to limit=1000 to fetch all records
  orders:         (params = '?limit=1000') => api.get(`/sales${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  order:          (id)      => api.get(`/sales/${id}`),
  createOrder:    (body)    => api.post('/sales', body),
  updateStatus:   (id, body)=> api.put(`/sales/${id}/status`, body),
  delete:         (id)      => api.delete(`/sales/${id}`),
};

// Reports
export const reportsApi = {
  sales:      (year)         => api.get(`/reports/sales?year=${year}`),
  addSalesExpense: (body)    => api.post('/reports/sales/expenses', body),
  production: (year)         => api.get(`/reports/production?year=${year}`),
  hr:         (year, month)  => api.get(`/reports/hr?year=${year}&month=${month}`),
  inventory:  ()             => api.get('/reports/inventory'),
};

export const settingsApi = {
  getAttendancePayrollPolicy: () => api.get('/settings/attendance-payroll'),
  updateAttendancePayrollPolicy: (body) => api.put('/settings/attendance-payroll', body),
};

// Production
export const productionApi = {
  list:         (params = '?limit=1000') => api.get(`/production${params}`).then(r => {
    if (Array.isArray(r?.data)) return r.data;
    if (Array.isArray(r)) return r;
    return [];
  }),
  get:          (id)          => api.get(`/production/${id}`),
  create:       (body)        => api.post('/production', body),
  updateStatus: (id, body)    => api.put(`/production/${id}/status`, body),
};

export const productionTrackingApi = {
  list: (params = '?limit=1000') => api.get(`/production-orders${params}`).then((r) => {
    if (Array.isArray(r?.data)) return r.data;
    return [];
  }),
  machines: () => api.get('/production-orders/machines').then((r) => {
    if (Array.isArray(r?.data)) return r.data;
    return [];
  }),
  createOrder: (body) => api.post('/production-orders', body),
  addSorting: (id, body) => api.post(`/production-orders/${id}/sorting`, body),
  addFinal: (id, body) => api.post(`/production-orders/${id}/final`, body),
  getReport: (id) => api.get(`/production-orders/${id}/report`),
};
