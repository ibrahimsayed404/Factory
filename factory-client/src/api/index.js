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

  let finalPath = path;
  if (body && typeof body === 'object' && body.password) {
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
  stageEfficiency: () => api.get('/dashboard/stage-efficiency'),
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

// Products
export const productApi = {
  list:   (params = '?limit=1000') => api.get(`/products${params}`).then(r => Array.isArray(r) ? r : r?.data || []),
  get:    (id)          => api.get(`/products/${id}`),
  create: (body)        => api.post('/products', body),
  update: (id, body)    => api.put(`/products/${id}`, body),
  delete: (id)          => api.delete(`/products/${id}`),
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
  // Returns the full paged envelope { data, total, page, limit } so callers can
  // detect truncation and bound the fetch by a week date range.
  listPaged: (params = '') => api.get(`/payroll${params}`).then(r => ({
    data: Array.isArray(r?.data) ? r.data : [],
    total: Number(r?.total ?? (Array.isArray(r?.data) ? r.data.length : 0)),
    limit: Number(r?.limit ?? 0),
  })),
  create: (body)        => api.post('/payroll', body),
  updateManual: (id, body) => api.put(`/payroll/${id}/manual`, body),
  pay:    (id)          => api.put(`/payroll/${id}/pay`),
  deleteWeek: (weekStart) => api.delete(`/payroll/week/${weekStart}`),
};

// HR / Loans
export const hrApi = {
  loans: (params = '?limit=1000') => api.get(`/hr/loans${params}`).then((r) => {
    if (Array.isArray(r)) return r;
    if (Array.isArray(r?.data)) return r.data;
    return [];
  }),
  createLoan: (body) => api.post('/hr/loans', body),
  updateLoan: (id, body) => api.put(`/hr/loans/${id}`, body),
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
  delete:         (id, body)=> api.delete(`/sales/${id}`, body),
  analytics:      ()        => api.get('/sales/analytics'),
  outstanding:    ()        => api.get('/sales/outstanding-balances'),
  quotations:     (params = '?limit=1000') => api.get(`/sales-quotations${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  createQuotation:(body)    => api.post('/sales-quotations', body),
  convertQuotation:(id)     => api.post(`/sales-quotations/${id}/convert`),
  invoices:       (params = '?limit=1000') => api.get(`/sales-invoices${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  createInvoice:  (body)    => api.post('/sales-invoices', body),
  deliveryNotes:  (params = '?limit=1000') => api.get(`/delivery-notes${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  createDeliveryNote:(body) => api.post('/delivery-notes', body),
  returns:        (params = '?limit=1000') => api.get(`/sales-returns${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  createReturn:   (body)    => api.post('/sales-returns', body),
  creditNotes:    (params = '?limit=1000') => api.get(`/credit-notes${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  createCreditNote:(body)   => api.post('/credit-notes', body),
};

// Reports
export const reportsApi = {
  sales:      (params)       => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api.get(`/reports/sales${query}`);
  },
  addSalesExpense: (body)    => api.post('/reports/sales/expenses', body),
  production: (params)       => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api.get(`/reports/production${query}`);
  },
  hr:         (params)       => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api.get(`/reports/hr${query}`);
  },
  inventory:  ()             => api.get('/reports/inventory'),
};

export const settingsApi = {
  getAttendancePayrollPolicy: () => api.get('/settings/attendance-payroll'),
  updateAttendancePayrollPolicy: (body) => api.put('/settings/attendance-payroll', body),
};

export const accountingApi = {
  accounts: (params = '') => api.get(`/accounting/accounts${params}`),
  createAccount: (body) => api.post('/accounting/accounts', body),
  cashAccounts: () => api.get('/accounting/cash-accounts'),
  createCashAccount: (body) => api.post('/accounting/cash-accounts', body),
  bankAccounts: () => api.get('/accounting/bank-accounts'),
  createBankAccount: (body) => api.post('/accounting/bank-accounts', body),
  journalEntries: (params = '') => api.get(`/accounting/journal-entries${params}`),
  journalEntry: (id) => api.get(`/accounting/journal-entries/${id}`),
  createJournalEntry: (body) => api.post('/accounting/journal-entries', body),
  generalLedger: (params = '') => api.get(`/accounting/general-ledger${params}`),
  trialBalance: (params = '') => api.get(`/accounting/trial-balance${params}`),
  profitLoss: (params = '') => api.get(`/accounting/profit-loss${params}`),
  balanceSheet: (params = '') => api.get(`/accounting/balance-sheet${params}`),
  createExpense: (body) => api.post('/accounting/expenses', body),
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
  completeWorkOrder: (workOrderId, body) => api.put(`/production/work-orders/${workOrderId}/complete`, body),
};

export const manufacturingApi = {
  boms: () => api.get('/manufacturing/boms').then(r => Array.isArray(r) ? r : r?.data || []),
  createBom: (body) => api.post('/manufacturing/boms', body),
  
  stages: () => api.get('/manufacturing/stages').then(r => Array.isArray(r) ? r : r?.data || []),
  createStage: (body) => api.post('/manufacturing/stages', body),
  
  routings: () => api.get('/manufacturing/routings').then(r => Array.isArray(r) ? r : r?.data || []),
  createRouting: (body) => api.post('/manufacturing/routings', body),
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
  addOutsourcing: (id, body) => api.post(`/production-orders/${id}/outsourcing`, body),
  addFinal: (id, body) => api.post(`/production-orders/${id}/final`, body),
  getReport: (id) => api.get(`/production-orders/${id}/report`),
  deleteOrder: (id, body) => api.delete(`/production-orders/${id}`, body),
};

export const qcApi = {
  inspections: (params = '') => api.get(`/qc/inspections${params}`).then(r => Array.isArray(r) ? r : r?.data || []),
  getInspection: (id) => api.get(`/qc/inspections/${id}`).then(r => r?.data || r),
  createInspection: (body) => api.post('/qc/inspections', body),
  updateResults: (id, body) => api.put(`/qc/inspections/${id}/results`, body),
  uploadPhoto: (id, formData) => api.post(`/qc/inspections/${id}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  defectCategories: () => api.get('/qc/defect-categories').then(r => Array.isArray(r) ? r : r?.data || []),
  reports: () => api.get('/qc/reports').then(r => r?.data || r),
};
