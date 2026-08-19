import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;

/** Start Google Drive OAuth through the Vercel server so the Railway API
 * receives the httpOnly Supabase bearer token from the Vercel cookie. */
export async function GET() {
  const token = cookies().get('sb_access_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'no active session' }, { status: 401 });
  }
  if (!BACKEND) {
    return NextResponse.json({ error: 'backend missing' }, { status: 500 });
  }

  const response = await fetch(`${BACKEND.replace(/\/$/, '')}/drive/connect`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'manual',
    cache: 'no-store',
  });

  const location = response.headers.get('location');
  if (location && response.status >= 300 && response.status < 400) {
    return NextResponse.redirect(location);
  }

  const body = await response.text();
  return new NextResponse(body || 'Unable to start Google Drive OAuth', {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') ?? 'text/plain' },
  });
}
