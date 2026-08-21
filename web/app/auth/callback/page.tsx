'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '../../../lib/supabase';

function callbackError(code: string | null, description: string | null) {
  if (code === 'otp_expired' || code === 'access_denied') return 'otp_expired';
  if (description) return 'verification_failed';
  return code || 'verification_failed';
}

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const query = new URLSearchParams(window.location.search);
      const error = hash.get('error') || query.get('error');
      const errorCode = hash.get('error_code') || query.get('error_code');
      const errorDescription = hash.get('error_description') || query.get('error_description');
      if (error || errorCode) {
        const message = callbackError(errorCode || error, errorDescription);
        router.replace(`/login?error=${encodeURIComponent(message)}`);
        return;
      }

      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      if (supabase && accessToken && refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (sessionError || !data.session) {
          router.replace('/login?error=verification_failed');
          return;
        }
        await fetch('/api/auth/setSession', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in }),
        });
        if (!cancelled) router.replace('/');
        return;
      }

      if (supabase && query.get('code')) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(query.get('code')!);
        if (exchangeError || !data.session) {
          router.replace('/login?error=verification_failed');
          return;
        }
        await fetch('/api/auth/setSession', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in }),
        });
        if (!cancelled) router.replace('/');
        return;
      }

      const tokenHash = query.get('token_hash');
      const tokenType = query.get('type') as 'email' | 'sms' | 'email_change' | 'recovery' | null;
      if (supabase && tokenHash && tokenType) {
        const { data, error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tokenType });
        if (otpError || !data.session) {
          router.replace(`/login?error=${otpError?.code === 'otp_expired' ? 'otp_expired' : 'verification_failed'}`);
          return;
        }
        await fetch('/api/auth/setSession', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_in: data.session.expires_in }),
        });
        if (!cancelled) router.replace('/');
        return;
      }

      if (!cancelled) router.replace('/login?error=no_session');
    })();
    return () => { cancelled = true; };
  }, [router]);

  return <main className="min-h-screen flex items-center justify-center bg-background p-6 text-sm text-foreground-muted">Memverifikasi email Anda…</main>;
}
