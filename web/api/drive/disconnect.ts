import type { IncomingMessage, ServerResponse } from 'node:http';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'DELETE') { res.statusCode = 405; res.setHeader('Allow', 'DELETE'); res.end(); return; }
  const item = (req.headers.cookie ?? '').split(';').map((v) => v.trim()).find((v) => v.startsWith('sb_access_token='));
  const accessToken = item ? decodeURIComponent(item.slice('sb_access_token='.length)) : undefined;
  const base = BACKEND?.replace(/\/+$/, '').replace(/\/api$/i, '');
  if (!accessToken) { res.statusCode = 401; res.end(JSON.stringify({ error: 'no active session' })); return; }
  if (!base) { res.statusCode = 500; res.end(JSON.stringify({ error: 'backend URL is missing' })); return; }
  const response = await fetch(`${base}/drive/disconnect`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
  res.statusCode = response.status;
  res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json');
  res.end(await response.text());
}
