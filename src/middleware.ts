// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get stored tokens from cookies
  const hasIdToken = request.cookies.has('idToken');
  const hasAccessToken = request.cookies.has('accessToken');

  // Get the current path
  const path = request.nextUrl.pathname;

  // Define paths that don't require authentication
  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

  const isPublicPath = publicPaths.some(pp => path === pp || path.startsWith(`${pp}/`));

  // Check if user is authenticated
  const isAuthenticated = hasIdToken && hasAccessToken;

  // If user is not authenticated and trying to access a protected route
  if (!isAuthenticated && !isPublicPath) {
    // Simply redirect to login without any parameters
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Continue with the request
  return NextResponse.next();
}

// Configure matcher to exclude static files and API routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - api (API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};
