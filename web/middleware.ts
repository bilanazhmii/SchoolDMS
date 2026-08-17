import {
  NextRequest,
  NextResponse,
} from 'next/server';

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allow public files and api routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || PUBLIC_FILE.test(pathname)) {
    return;
  }

  // Login is always accessible — redirect handled by the login page itself
  if (pathname === '/login') {
    return;
  }

  const access = req.cookies.get('sb_access_token')?.value ?? req.cookies.get('sb-access-token')?.value;

  // No token: redirect to login for protected routes
  if (!access) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Has token: allow access (avoid backend verification loops when backend is down)
  return;
}

export const config = {
  matcher: ['/', '/explorer/:path*', '/drive/:path*', '/dashboard/:path*'],
};
