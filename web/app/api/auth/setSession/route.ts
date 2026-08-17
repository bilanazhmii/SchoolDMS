import { cookies } from 'next/headers';
import {
  NextRequest,
  NextResponse,
} from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { access_token, refresh_token, expires_in } = body;

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'tokens required' }, { status: 400 });
  }

  const accessMaxAge = typeof expires_in === 'number' ? Math.max(60, Math.floor(expires_in)) : 60 * 60;
  const refreshMaxAge = 60 * 60 * 24 * 30; // 30 days

  const c = cookies();
  const isProd = process.env.NODE_ENV === 'production';
  c.set({ name: 'sb_access_token', value: access_token, httpOnly: true, secure: isProd, path: '/', maxAge: accessMaxAge, sameSite: 'lax' });
  c.set({ name: 'sb_refresh_token', value: refresh_token, httpOnly: true, secure: isProd, path: '/', maxAge: refreshMaxAge, sameSite: 'lax' });

  return NextResponse.json({ ok: true });
}
