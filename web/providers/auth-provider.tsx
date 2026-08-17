"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  createClient,
  SupabaseClient,
} from '@supabase/supabase-js';

export interface AuthContextValue {
  supabase: SupabaseClient | null;
}

const AuthContext = createContext<AuthContextValue>({ supabase: null });

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      setSupabase(createClient(url, key, { global: { fetch } }));
    }
  }, []);

  return <AuthContext.Provider value={{ supabase }}>{children}</AuthContext.Provider>;
}

export { AuthContext };
