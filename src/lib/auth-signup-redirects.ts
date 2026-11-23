/**
 * Legacy signup URLs that used to 404. Stytch loginOrCreate covers signup, so
 * these permanently redirect to /login. Query strings are preserved by Next.
 */
export const AUTH_SIGNUP_REDIRECTS = [
  { source: '/signup', destination: '/login', permanent: true },
  { source: '/sign-up', destination: '/login', permanent: true },
  { source: '/register', destination: '/login', permanent: true },
  { source: '/join', destination: '/login', permanent: true },
] as const;

/** Paths that must never be used as post-login returnTo targets. */
export const AUTH_DEAD_END_PATHS = ['/login', ...AUTH_SIGNUP_REDIRECTS.map(r => r.source)] as const;
