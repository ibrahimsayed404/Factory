import { api } from '../../api/client';

export const manufacturingApi = {
  boms: () => api.get('/manufacturing/boms').then(r => Array.isArray(r) ? r : r?.data || []),
  createBom: (body) => api.post('/manufacturing/boms', body),
  
  stages: () => api.get('/manufacturing/stages').then(r => Array.isArray(r) ? r : r?.data || []),
  createStage: (body) => api.post('/manufacturing/stages', body),
  
  routings: () => api.get('/manufacturing/routings').then(r => Array.isArray(r) ? r : r?.data || []),
  createRouting: (body) => api.post('/manufacturing/routings', body),
};
