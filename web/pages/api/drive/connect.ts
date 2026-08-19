import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;

/** Start Google Drive OAuth through Vercel so the httpOnly session token is
 * forwarded to the Railway backend. Pages API is used for broad Vercel
 * compatibility with this existing Next.js 14 deployment. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const token = req.cookies.sb_access_token;
  if (!token) return res.status(401).json({ error: 'no active session' });
  if (!BACKEND || !/^https?:\/\//i.test(BACKEND)) {
    return res.status(500).json({ error: 'backend URL is missing or invalid' });
  }

  try {
    const response = await fetch(`${BACKEND.replace(/\/$/, '')}/drive/connect`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
    });
    const location = response.headers.get('location');
    if (location && response.status >= 300 && response.status < 400) {
      return res.redirect(302, location);
    }

    const body = await response.text();
    res.status(response.status).send(body || 'Unable to start Google Drive OAuth');
  } catch (error) {
    console.error('Drive OAuth backend request failed', error);
    res.status(502).json({ error: 'backend unreachable' });
  }
}
