import { api } from '../../api/client';

// Reports
export const reportsApi = {
  sales:      (params)       => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api.get(`/reports/sales${query}`);
  },
  addSalesExpense: (body)    => api.post('/reports/sales/expenses', body),
  listSalesExpenses: (params) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return api.get(`/reports/sales/expenses${query}`);
  },
  updateSalesExpense: (id, body) => api.put(`/reports/sales/expenses/${id}`, body),
  deleteSalesExpense: (id) => api.delete(`/reports/sales/expenses/${id}`),
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
