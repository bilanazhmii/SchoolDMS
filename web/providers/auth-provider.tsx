"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { SupabaseClient } from '@supabase/supabase-js';

import { supabase as sharedSupabase } from '../lib/supabase';

export interface AuthContextValue {
  supabase: SupabaseClient | null;
}

const AuthContext = createContext<AuthContextValue>({ supabase: null });

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState<SupabaseClient | null>(sharedSupabase);

  useEffect(() => {
    // no-op: single shared instance, nothing to construct
  }, []);

  return <AuthContext.Provider value={{ supabase }}>{children}</AuthContext.Provider>;
}

export { AuthContext };
