import { api } from '../../api/client';

// Print Shops (دليل المطابع)
export const printShopApi = {
  list: () => api.get('/print-shops').then(r => Array.isArray(r) ? r : r?.data || []),
  get: (id) => api.get(`/print-shops/${id}`),
  create: (body) => api.post('/print-shops', body),
  update: (id, body) => api.put(`/print-shops/${id}`, body),
  delete: (id) => api.delete(`/print-shops/${id}`),
};
