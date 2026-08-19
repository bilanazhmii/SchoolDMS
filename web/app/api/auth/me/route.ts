import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;

export async function GET() {
  const c = cookies();
  const token = c.get('sb_access_token')?.value;

  if (!token) return NextResponse.json({ error: 'no token' }, { status: 401 });

  if (!BACKEND) return NextResponse.json({ error: 'backend missing' }, { status: 500 });

  const backendBase = BACKEND.replace(/\/+$/, '').replace(/\/api$/i, '');
  const resp = await fetch(`${backendBase}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    return new Response(text, { status: resp.status });
  }

  const data = await resp.json();
  return NextResponse.json(data);
}
