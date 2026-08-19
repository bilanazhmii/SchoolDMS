"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import type {
  Session,
  User,
} from '@supabase/supabase-js';

import type { AuthContextValue } from './auth-provider';
import { AuthContext } from './auth-provider';

interface SessionContextValue {
  session: Session | null;
  user: User | null;
  ready: boolean;
  setSession: (s: Session | null) => void;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  user: null,
  ready: false,
  setSession: () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

export default function SessionProvider({ children }: { children: ReactNode }) {
  const { supabase } = useContext(AuthContext) as AuthContextValue;
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);

      // Send tokens to server to set secure HttpOnly cookies
      if (data.session?.access_token && data.session?.refresh_token) {
        try {
          await fetch('/api/auth/setSession', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_in: data.session.expires_in,
            }),
          });
        } catch (e) {
          // ignore
        }
      }
      setReady(true);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
      setUser(sess?.user ?? null);
      if (sess?.access_token && sess?.refresh_token) {
        fetch('/api/auth/setSession', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: sess.access_token, refresh_token: sess.refresh_token, expires_in: sess.expires_in }),
        }).catch(() => {});
      }
      if (!sess) {
        // clear server cookies on sign out
        fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!ready) return null;

  return <SessionContext.Provider value={{ session, user, ready, setSession }}>{children}</SessionContext.Provider>;
}

export { SessionContext };
