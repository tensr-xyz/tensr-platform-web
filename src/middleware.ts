import { NextResponse, NextRequest } from 'next/server';

function decodeJWT(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  // Get stored tokens from cookies
  const idToken = request.cookies.get('idToken')?.value;
  const accessToken = request.cookies.get('accessToken')?.value;

  // Get the current path
  const path = request.nextUrl.pathname;

  // Define paths that don't require authentication
  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

  // Define paths that don't require subscription (but do require auth)
  const noSubscriptionRequiredPaths = ['/subscription', '/settings/billing'];

  const isPublicPath = publicPaths.some(pp => path === pp || path.startsWith(`${pp}/`));
  const isNoSubscriptionRequiredPath = noSubscriptionRequiredPaths.some(
    pp => path === pp || path.startsWith(`${pp}/`)
  );

  // Check if user is authenticated
  const isAuthenticated = idToken && accessToken;

  // If user is not authenticated and trying to access a protected route
  if (!isAuthenticated && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If user is authenticated, check subscription status (except for public paths and subscription-exempt paths)
  if (isAuthenticated && !isPublicPath && !isNoSubscriptionRequiredPath && idToken) {
    const decoded = decodeJWT(idToken);

    if (decoded) {
      const requiresSubscription = decoded['custom:requiresSubscription'] === 'true';
      const hasActiveSubscription = decoded['custom:hasActiveSubscription'] === 'true';
      const subscriptionStatus = decoded['custom:subscriptionStatus'];

      // If user requires subscription but doesn't have one, redirect to subscription page
      if (requiresSubscription && !hasActiveSubscription && subscriptionStatus === 'none') {
        return NextResponse.redirect(new URL('/subscription', request.url));
      }
    }
  }

  // Continue with the request
  return NextResponse.next();
}

// Configure matcher to exclude static files and API routes
export const config = {
  matcher: [
    // Exclude all files in the public folder and all Next.js image requests
    '/((?!_next/static|_next/image|favicon.ico|tensr_icon_dark.png|tensr_icon_light.png|tensr_logo_dark.png|tensr_logo_light.png).*)',
  ],
};
