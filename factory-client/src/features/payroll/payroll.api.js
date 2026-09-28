import { api } from '../../api/client';

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
  payWeek: (weekStart)  => api.put(`/payroll/week/${weekStart}/pay`),
  deleteWeek: (weekStart) => api.delete(`/payroll/week/${weekStart}`),
};
