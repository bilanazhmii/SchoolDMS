export function getAuthRedirectUrl(path = '/auth/callback') {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
  const base = configured || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const normalized = base.startsWith('http://') || base.startsWith('https://') ? base : `https://${base}`;
  return `${normalized.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
