import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/login?error=config', req.url));
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  let session = null;

  // Flow 1: PKCE / code exchange (from emailRedirectTo link)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL('/login?error=verification_failed', req.url));
    }
    session = data.session;
  }

  // Flow 2: token_hash (legacy email confirmation link)
  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'email' | 'sms' | 'email_change' | 'recovery',
    });
    if (error) {
      return NextResponse.redirect(new URL('/login?error=verification_failed', req.url));
    }
    session = data.session;
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login?error=no_session', req.url));
  }

  // Set httpOnly cookies via the setSession API route
  await fetch(new URL('/api/auth/setSession', req.url).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    }),
  });

  // Redirect to dashboard
  return NextResponse.redirect(new URL('/', req.url));
}