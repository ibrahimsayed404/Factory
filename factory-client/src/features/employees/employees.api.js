import { api } from '../../api/client';

// Employees
export const employeeApi = {
  departments:   ()        => api.get('/departments').then(r => {
    if (Array.isArray(r?.data)) return r.data;
    if (Array.isArray(r)) return r;
    return [];
  }),
  list:          (params = '?limit=1000', includeTerminated = false) => api.get(`/employees${params}`).then(r => {
    const data = Array.isArray(r?.data) ? r.data : [];
    return includeTerminated ? data : data.filter(e => e.status !== 'terminated');
  }),
  get:           (id)      => api.get(`/employees/${id}`),
  create:        (body)    => api.post('/employees', body),
  update:        (id, body)=> api.put(`/employees/${id}`, body),
  delete:        (id)      => api.delete(`/employees/${id}`),
  logAttendance: (id, body)=> api.post(`/employees/${id}/attendance`, body),
  attendance:    (id, q)   => api.get(`/employees/${id}/attendance${q || ''}`),
};
