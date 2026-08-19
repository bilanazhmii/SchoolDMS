import axios, { AxiosRequestConfig } from 'axios';

// The access token lives in an httpOnly cookie (sb_access_token), so the API
// client does not need a Supabase client instance — it authenticates via
// cookies (withCredentials). Creating a second Supabase client here caused
// "Multiple GoTrueClient instances" warnings in the browser.
const configuredBase = process.env.NEXT_PUBLIC_API_URL ?? '/';
const baseURL = configuredBase.replace(/\/+$/, '').replace(/\/api$/i, '') || '/';

const api = axios.create({ baseURL, withCredentials: true });

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
