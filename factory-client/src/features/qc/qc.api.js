import { api } from '../../api/client';

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
