import { api } from '../../api/client';

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

// 4-Stage Production Cycle API (دورة العمليات: قص - فرز - مطبعة - تسليم)
export const productionCycleApi = {
  listOrders: (params = '') => api.get(`/production-cycle/orders${params}`).then(r => Array.isArray(r) ? r : r?.data || []),
  getOrder: (id) => api.get(`/production-cycle/orders/${id}`),
  createCutting: (body) => api.post('/production-cycle/orders/cutting', body),
  submitSorting: (id, body) => api.put(`/production-cycle/orders/${id}/sorting`, body),
  sendToPrint: (id, body) => api.put(`/production-cycle/orders/${id}/print/send`, body),
  receiveFromPrint: (id, body) => api.put(`/production-cycle/orders/${id}/print/receive`, body),
  skipPrint: (id) => api.put(`/production-cycle/orders/${id}/print/skip`),
  submitMachines: (id, body) => api.put(`/production-cycle/orders/${id}/machines`, body),
  deliver: (id, body) => api.put(`/production-cycle/orders/${id}/deliver`, body),
  deleteOrder: (id) => api.delete(`/production-cycle/orders/${id}`),
  getKPIs: () => api.get('/production-cycle/kpis'),
};
