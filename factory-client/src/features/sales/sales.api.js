import { api } from '../../api/client';

// Sales
export const salesApi = {
  customers:      (params = '?limit=1000') => api.get(`/customers${params}`).then(r => {
    if (Array.isArray(r?.data)) return r.data;
    if (Array.isArray(r)) return r;
    return [];
  }),
  customerLedger: (id)      => api.get(`/customers/${id}/ledger`),
  addPayment:     (id, body)=> api.post(`/customers/${id}/payments`, body),
  updatePayment:  (customerId, paymentId, body) => api.put(`/customers/${customerId}/payments/${paymentId}`, body),
  deletePayment:  (customerId, paymentId) => api.delete(`/customers/${customerId}/payments/${paymentId}`),
  createCustomer: (body)    => api.post('/customers', body),
  // Returns the data array directly; defaults to limit=1000 to fetch all records
  orders:         (params = '?limit=1000') => api.get(`/sales${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  order:          (id)      => api.get(`/sales/${id}`),
  createOrder:    (body)    => api.post('/sales', body),
  updateStatus:   (id, body)=> api.put(`/sales/${id}/status`, body),
  delete:         (id, body)=> api.delete(`/sales/${id}`, body),
  analytics:      ()        => api.get('/sales/analytics'),
  outstanding:    ()        => api.get('/sales/outstanding-balances'),
  quotations:     (params = '?limit=1000') => api.get(`/sales-quotations${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  createQuotation:(body)    => api.post('/sales-quotations', body),
  convertQuotation:(id)     => api.post(`/sales-quotations/${id}/convert`),
  invoices:       (params = '?limit=1000') => api.get(`/sales-invoices${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  createInvoice:  (body)    => api.post('/sales-invoices', body),
  deliveryNotes:  (params = '?limit=1000') => api.get(`/delivery-notes${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  createDeliveryNote:(body) => api.post('/delivery-notes', body),
  returns:        (params = '?limit=1000') => api.get(`/sales-returns${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  createReturn:   (body)    => api.post('/sales-returns', body),
  creditNotes:    (params = '?limit=1000') => api.get(`/credit-notes${params}`).then(r => Array.isArray(r?.data) ? r.data : []),
  createCreditNote:(body)   => api.post('/credit-notes', body),
};
