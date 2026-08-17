"use client";

import { ReactNode } from 'react';

import AuthProvider from './auth-provider';
import ReactQueryProvider from './react-query-provider';
import SessionProvider from './session-provider';
import ThemeProviders from './theme-provider';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProviders>
      <AuthProvider>
        <SessionProvider>
          <ReactQueryProvider>{children}</ReactQueryProvider>
        </SessionProvider>
      </AuthProvider>
    </ThemeProviders>
  );
}
