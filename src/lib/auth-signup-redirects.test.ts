import { AUTH_DEAD_END_PATHS, AUTH_SIGNUP_REDIRECTS } from './auth-signup-redirects';

describe('AUTH_SIGNUP_REDIRECTS', () => {
  it('permanently redirects every signup alias to /login', () => {
    expect(AUTH_SIGNUP_REDIRECTS).toEqual([
      { source: '/signup', destination: '/login', permanent: true },
      { source: '/sign-up', destination: '/login', permanent: true },
      { source: '/register', destination: '/login', permanent: true },
      { source: '/join', destination: '/login', permanent: true },
    ]);
  });

  it('blocks login and every signup alias as returnTo targets', () => {
    expect(AUTH_DEAD_END_PATHS).toEqual(['/login', '/signup', '/sign-up', '/register', '/join']);
  });
});
