import { cookies } from 'next/headers';
import {
  NextRequest,
  NextResponse,
} from 'next/server';

export async function POST(_req: NextRequest) {
  const c = cookies();
  c.set({ name: 'sb_access_token', value: '', httpOnly: true, secure: true, path: '/', maxAge: 0 });
  c.set({ name: 'sb_refresh_token', value: '', httpOnly: true, secure: true, path: '/', maxAge: 0 });
  return NextResponse.json({ ok: true });
}
