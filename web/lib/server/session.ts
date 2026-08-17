import { cookies } from 'next/headers';

export async function getServerProfile() {
  const c = cookies();
  const token = c.get('sb_access_token')?.value;
  if (!token) return null;

  const backend = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backend) return null;

  const res = await fetch(`${backend.replace(/\/$/, '')}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

