import { NextResponse, NextRequest } from 'next/server';

/** Public routes that never require authentication. */
export const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/features',
  '/pricing',
  '/enterprise',
  '/download',
  '/visualiser',
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/api')) return true;
  if (/\.(ico|png|jpg|jpeg|svg|webp|gif|txt|xml)$/i.test(pathname)) return true;
  return false;
}

function shouldBypassAuth(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.E2E_AUTH_BYPASS === 'true';
}

export function validateStytchSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (shouldBypassAuth(request)) {
    return NextResponse.next();
  }

  // Opaque session token is the long-lived credential; JWT is short-lived and refreshed client-side.
  const sessionToken = request.cookies.get('stytch_session_token')?.value;

  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export function proxy(request: NextRequest) {
  return validateStytchSession(request);
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/workspace/:path*',
    '/settings/:path*',
    '/plugins/:path*',
    '/creator/:path*',
    '/project/:path*',
    '/subscription',
  ],
};
