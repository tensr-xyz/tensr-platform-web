/** Post-login destinations that match app routes (see proxy matcher). */
const ALLOWED_RETURN_TO_PREFIXES = [
  '/dashboard',
  '/workspace',
  '/settings',
  '/plugins',
  '/admin/plugins',
  '/creator',
  '/project',
  '/subscription',
] as const;

const BLOCKED_RETURN_TO_PATHS = new Set(['/login', '/sign-up', '/register']);

/**
 * Sanitize `returnTo` query values so auth flows never send users to missing
 * or external paths (e.g. `/sign-up` after a dead link + session redirect).
 */
export function safeReturnTo(returnTo: string | null | undefined, fallback = '/dashboard'): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return fallback;
  }

  const pathname = returnTo.split(/[?#]/, 1)[0] ?? returnTo;
  if (BLOCKED_RETURN_TO_PATHS.has(pathname)) {
    return fallback;
  }

  const allowed = ALLOWED_RETURN_TO_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  return allowed ? returnTo : fallback;
}
