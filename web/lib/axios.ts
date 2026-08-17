import axios, { AxiosRequestConfig } from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/', withCredentials: true });

// On 401, try to refresh session and retry once
api.interceptors.response.use(undefined, async (error) => {
  const original = error.config as AxiosRequestConfig & { _retry?: boolean };
  if (error.response && error.response.status === 401 && !original._retry) {
    original._retry = true;
    try {
      await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      return api(original);
    } catch (e) {
      // fall through
    }
  }
  return Promise.reject(error);
});

export default api;
