import { api } from '../../api/client';

export const settingsApi = {
  getAttendancePayrollPolicy: () => api.get('/settings/attendance-payroll'),
  updateAttendancePayrollPolicy: (body) => api.put('/settings/attendance-payroll', body),
};
