"use client";

import { ReactNode, useEffect, useState } from 'react';

import AuthProvider from './auth-provider';
import ReactQueryProvider from './react-query-provider';
import SessionProvider from './session-provider';
import ThemeProviders from './theme-provider';

/**
 * Client gate prevents server/client markup divergence from Supabase session
 * state and next-themes. It removes the React #418/#423 hydration errors while
 * retaining the normal app shell after the first client mount.
 */
export default function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <ThemeProviders>
      <AuthProvider>
        <SessionProvider>
          <ReactQueryProvider>{mounted ? children : null}</ReactQueryProvider>
        </SessionProvider>
      </AuthProvider>
    </ThemeProviders>
  );
}
