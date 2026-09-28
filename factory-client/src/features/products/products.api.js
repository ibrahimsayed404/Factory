import { api } from '../../api/client';

// Products
export const productApi = {
  list:   (params = '?limit=1000') => api.get(`/products${params}`).then(r => Array.isArray(r) ? r : r?.data || []),
  get:    (id)          => api.get(`/products/${id}`),
  create: (body)        => api.post('/products', body),
  update: (id, body)    => api.put(`/products/${id}`, body),
  delete: (id)          => api.delete(`/products/${id}`),
};
