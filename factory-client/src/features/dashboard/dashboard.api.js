import { api } from '../../api/client';

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  stageEfficiency: () => api.get('/dashboard/stage-efficiency'),
};
