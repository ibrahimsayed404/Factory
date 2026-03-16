let BASE = process.env.REACT_APP_API_URL || '/api';
if (typeof window !== 'undefined' && window.location.protocol === 'file:' && BASE.startsWith('/')) {
  BASE = 'http://localhost:5000/api';
}

const getApiOrigin = () => {
  if (typeof window === 'undefined') return '';

  if (BASE.startsWith('http://') || BASE.startsWith('https://')) {
    try {
      return new URL(BASE).origin;
    } catch (_e) {
      return window.location.origin;
    }
  }

  if (window.location.hostname === 'localhost' && window.location.port === '3000') {
    return 'http://localhost:5000';
  }

  return window.location.origin;
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
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = isFormData ? {} : { 'Content-Type': 'application/json' };

  // Add token for Electron/cross-origin scenarios
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  delete: (path)         => request('DELETE', path),
};

// Auth
export const authApi = {
  login:    (body) => api.post('/auth/login', body),
  register: (body) => api.post('/auth/register', body),
  me:       ()     => api.get('/auth/me'),
  logout:   ()     => api.post('/auth/logout'),
};

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
};

// Inventory
export const inventoryApi = {
  // Returns the data array directly; defaults to limit=1000 to fetch all records
  list:   (params = '?limit=1000') => api.get(`/inventory${params}`).then(r => (r && r.data !== undefined ? r.data : r)),
  get:    (id)          => api.get(`/inventory/${id}`),
  create: (body)        => api.post('/inventory', body),
  update: (id, body)    => api.put(`/inventory/${id}`, body),
  delete: (id)          => api.delete(`/inventory/${id}`),
};

// Employees
export const employeeApi = {
  departments:   ()        => api.get('/departments'),
  // Returns the data array directly; defaults to limit=1000 to fetch all records
  list:          (params = '?limit=1000') => api.get(`/employees${params}`).then(r => (r && r.data !== undefined ? r.data : r)),
  get:           (id)      => api.get(`/employees/${id}`),
  create:        (body)    => api.post('/employees', body),
  update:        (id, body)=> api.put(`/employees/${id}`, body),
  delete:        (id)      => api.delete(`/employees/${id}`),
  logAttendance: (id, body)=> api.post(`/employees/${id}/attendance`, body),
  attendance:    (id, q)   => api.get(`/employees/${id}/attendance${q || ''}`),
};

// Payroll
export const payrollApi = {
  list:   (params = '') => api.get(`/payroll${params}`),
  create: (body)        => api.post('/payroll', body),
  pay:    (id)          => api.put(`/payroll/${id}/pay`),
};

// Sales
export const salesApi = {
  customers:      ()        => api.get('/customers'),
  customerLedger: (id)      => api.get(`/customers/${id}/ledger`),
  addPayment:     (id, body)=> api.post(`/customers/${id}/payments`, body),
  createCustomer: (body)    => api.post('/customers', body),
  // Returns the data array directly; defaults to limit=1000 to fetch all records
  orders:         (params = '?limit=1000') => api.get(`/sales${params}`).then(r => (r && r.data !== undefined ? r.data : r)),
  order:          (id)      => api.get(`/sales/${id}`),
  createOrder:    (body)    => api.post('/sales', body),
  updateStatus:   (id, body)=> api.put(`/sales/${id}/status`, body),
};

// Reports
export const reportsApi = {
  sales:      (year)         => api.get(`/reports/sales?year=${year}`),
  addSalesExpense: (body)    => api.post('/reports/sales/expenses', body),
  production: (year)         => api.get(`/reports/production?year=${year}`),
  hr:         (year, month)  => api.get(`/reports/hr?year=${year}&month=${month}`),
  inventory:  ()             => api.get('/reports/inventory'),
};

// Production
export const productionApi = {
  list:         (params = '') => api.get(`/production${params}`),
  get:          (id)          => api.get(`/production/${id}`),
  create:       (body)        => api.post('/production', body),
  updateStatus: (id, body)    => api.put(`/production/${id}/status`, body),
};
