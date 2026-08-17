import { cookies } from 'next/headers';
import {
  NextRequest,
  NextResponse,
} from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function parseCookies(cookieHeader?: string) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.split('=');
    if (!k) continue;
    map[k.trim()] = decodeURIComponent((v || []).join('=').trim());
  }
  return map;
}

export async function POST(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookiesIn = parseCookies(cookieHeader);
  const refreshToken = cookiesIn['sb_refresh_token'];

  if (!refreshToken) return NextResponse.json({ error: 'no refresh token' }, { status: 401 });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'server not configured' }, { status: 500 });
  }

  // Call Supabase token refresh
  const tokenUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`;

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!resp.ok) {
    return NextResponse.json({ error: 'refresh failed' }, { status: 401 });
  }

  const data = await resp.json();
  const { access_token, refresh_token, expires_in } = data;

  const accessMaxAge = typeof expires_in === 'number' ? Math.max(60, Math.floor(expires_in)) : 60 * 60;
  const refreshMaxAge = 60 * 60 * 24 * 30;

  const c = cookies();
  const isProd = process.env.NODE_ENV === 'production';
  c.set({ name: 'sb_access_token', value: access_token, httpOnly: true, secure: isProd, path: '/', maxAge: accessMaxAge, sameSite: 'lax' });
  c.set({ name: 'sb_refresh_token', value: refresh_token, httpOnly: true, secure: isProd, path: '/', maxAge: refreshMaxAge, sameSite: 'lax' });

  return NextResponse.json({ ok: true });
}
