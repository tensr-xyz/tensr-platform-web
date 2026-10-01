import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
  NextResponse: {
    next: () => ({ kind: 'next' }),
    redirect: (url: URL) => ({ kind: 'redirect', url: url.toString() }),
  },
}));

import { config, validateStytchSession } from './proxy';

function request(path: string, cookies: Record<string, string> = {}): NextRequest {
  const url = new URL(path, 'https://app.tensr.test');
  return {
    url: url.toString(),
    nextUrl: url,
    cookies: {
      get: (name: string) => (name in cookies ? { name, value: cookies[name] } : undefined),
    },
  } as unknown as NextRequest;
}

describe('proxy (edge session gate)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('redirects to /login with returnTo (including query) when there is no session cookie', () => {
    expect(validateStytchSession(request('/workspace/abc?tab=data'))).toEqual({
      kind: 'redirect',
      url: 'https://app.tensr.test/login?returnTo=%2Fworkspace%2Fabc%3Ftab%3Ddata',
    });
  });

  it.each(['stytch_session_token', 'stytch_session_jwt'])('lets requests with %s through', name => {
    expect(validateStytchSession(request('/dashboard', { [name]: 'x' }))).toEqual({ kind: 'next' });
  });

  it('ignores unrelated cookies', () => {
    expect(validateStytchSession(request('/dashboard', { other: 'x' }))).toMatchObject({
      kind: 'redirect',
    });
  });

  it('never gates /login itself (OAuth callback lands there)', () => {
    expect(validateStytchSession(request('/login?stytch_token_type=oauth&token=t'))).toEqual({
      kind: 'next',
    });
  });

  it('honours E2E_AUTH_BYPASS outside production only', () => {
    process.env = { ...originalEnv, E2E_AUTH_BYPASS: 'true', NODE_ENV: 'test' };
    expect(validateStytchSession(request('/dashboard'))).toEqual({ kind: 'next' });

    process.env = { ...originalEnv, E2E_AUTH_BYPASS: 'true', NODE_ENV: 'production' };
    expect(validateStytchSession(request('/dashboard'))).toMatchObject({ kind: 'redirect' });
  });

  it('protects every app area but not /login', () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining(['/dashboard/:path*', '/workspace/:path*', '/subscription'])
    );
    expect(config.matcher.some(m => m.startsWith('/login'))).toBe(false);
  });
});
