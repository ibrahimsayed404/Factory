import { api } from '../../api/client';

// Inventory
export const inventoryApi = {
  // Returns the data array directly; defaults to limit=1000 to fetch all records
  list:   (params = '?limit=1000') => api.get(`/inventory${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  get:    (id)          => api.get(`/inventory/${id}`),
  create: (body)        => api.post('/inventory', body),
  update: (id, body)    => api.put(`/inventory/${id}`, body),
  delete: (id)          => api.delete(`/inventory/${id}`),
};
