import { api } from '../../api/client';

// Reports
export const reportsApi = {
  sales:      (params)       => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api.get(`/reports/sales${query}`);
  },
  addSalesExpense: (body)    => api.post('/reports/sales/expenses', body),
  production: (params)       => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api.get(`/reports/production${query}`);
  },
  hr:         (params)       => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api.get(`/reports/hr${query}`);
  },
  inventory:  ()             => api.get('/reports/inventory'),
  printShops: (params)       => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api.get(`/reports/print-shops${query}`);
  },
};
