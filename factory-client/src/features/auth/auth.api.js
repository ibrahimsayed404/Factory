import { api, setAuthTokens } from '../../api/client';

// Auth
export const authApi = {
  login:    async (body) => {
    const data = await api.post('/auth/login', body);
    setAuthTokens(data || {});
    return data;
  },
  register: async (body) => {
    const data = await api.post('/auth/register', body);
    setAuthTokens(data || {});
    return data;
  },
  refresh:  (body) => api.post('/auth/refresh', body),
  me:       ()     => api.get('/auth/me'),
  logout:   (body) => api.post('/auth/logout', body),
};
