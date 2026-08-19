import axios, { AxiosRequestConfig } from 'axios';

import { supabase } from './supabase';

// The backend (Railway) is cross-origin, so httpOnly cookies set on the Vercel
// domain are NOT sent with these requests. We attach the Supabase access token
// explicitly. The shared supabase instance keeps auth in sync with the UI.
const configuredBase = process.env.NEXT_PUBLIC_API_URL ?? '/';
const baseURL = configuredBase.replace(/\/+$/, '').replace(/\/api$/i, '') || '/';

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
      await supabase?.auth.refreshSession();
      const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
      if (data.session?.access_token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${data.session.access_token}` };
      }
      return api(original);
    } catch (e) {
      // fall through
    }
  }
  return Promise.reject(error);
});

export default api;
