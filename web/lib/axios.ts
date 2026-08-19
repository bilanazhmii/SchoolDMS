import axios, { AxiosRequestConfig } from 'axios';
import { createClient } from '@supabase/supabase-js';

const configuredBase = process.env.NEXT_PUBLIC_API_URL ?? '/';
const baseURL = configuredBase.replace(/\/+$/, '').replace(/\/api$/i, '') || '/';
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

const api = axios.create({ baseURL, withCredentials: true });

api.interceptors.request.use(async (config) => {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
