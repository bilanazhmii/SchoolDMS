import type { IncomingMessage, ServerResponse } from 'node:http';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;

function readCookie(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie ?? '';
  const item = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end(JSON.stringify({ error: 'method not allowed' }));
    return;
  }

  const token = readCookie(req, 'sb_access_token');
  if (!token) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'no active session' }));
    return;
  }

  if (!BACKEND || !/^https?:\/\//i.test(BACKEND)) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'backend URL is missing or invalid' }));
    return;
  }

  try {
    // Backend NestJS does not use a global /api prefix. Accept an accidentally
    // configured /api suffix in Vercel, but remove it before forwarding.
    const backendBase = BACKEND.replace(/\/+$/, '').replace(/\/api$/i, '');
    const response = await fetch(`${backendBase}/drive/connect`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
    });
    const location = response.headers.get('location');
    if (location && response.status >= 300 && response.status < 400) {
      res.statusCode = 302;
      res.setHeader('Location', location);
      res.end();
      return;
    }

    res.statusCode = response.status;
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'text/plain');
    res.end(await response.text());
  } catch (error) {
    console.error('Drive OAuth backend request failed', error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'backend unreachable' }));
  }
}
