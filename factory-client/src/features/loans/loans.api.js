import { api } from '../../api/client';

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
