import {
  clearAuthData,
  getStoredSession,
  getStytchBearerForTensrApi,
  isSessionValid,
  persistStytchTokensFromSdk,
  storeSession,
} from './auth';

function jwtWithExp(expSecondsFromNow: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }));
  return `header.${payload}.sig`;
}

function clearCookies() {
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
}

describe('auth token storage', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCookies();
  });

  it('stores the session in localStorage and in cookies the proxy can read', () => {
    storeSession('sess-token', 'a.b.c');
    expect(getStoredSession()).toEqual({ sessionToken: 'sess-token', sessionJwt: 'a.b.c' });
    expect(document.cookie).toContain('stytch_session_token=sess-token');
    expect(document.cookie).toContain('stytch_session_jwt=a.b.c');
  });

  it('drops a stale JWT when a refresh only returns a session token', () => {
    storeSession('sess-token', 'old.jwt.value');
    storeSession('sess-token-2');
    expect(getStoredSession()).toEqual({ sessionToken: 'sess-token-2', sessionJwt: null });
    expect(document.cookie).not.toContain('stytch_session_jwt=');
  });

  it('mirrors fresh SDK tokens and ignores an empty SDK session', () => {
    expect(persistStytchTokensFromSdk({ session: { getTokens: () => null } })).toBeNull();
    expect(
      persistStytchTokensFromSdk({
        session: { getTokens: () => ({ session_token: 't2', session_jwt: 'x.y.z' }) },
      })
    ).toEqual({ sessionToken: 't2', sessionJwt: 'x.y.z' });
    expect(getStoredSession()?.sessionToken).toBe('t2');
  });

  it('clearAuthData removes tokens and cookies (logout)', () => {
    storeSession('sess-token', 'a.b.c');
    clearAuthData();
    expect(getStoredSession()).toBeNull();
    expect(document.cookie).not.toContain('stytch_session_token=sess-token');
  });

  describe('getStytchBearerForTensrApi', () => {
    it('prefers a still-valid JWT', () => {
      const jwt = jwtWithExp(3600);
      storeSession('sess-token', jwt);
      expect(getStytchBearerForTensrApi()).toBe(jwt);
    });

    it('falls back to the opaque session token when the JWT has expired', () => {
      storeSession('sess-token', jwtWithExp(-60));
      expect(getStytchBearerForTensrApi()).toBe('sess-token');
    });

    it('returns null when signed out', () => {
      expect(getStytchBearerForTensrApi()).toBeNull();
    });
  });

  describe('isSessionValid', () => {
    it('treats JWTs inside the expiry buffer as expired', () => {
      expect(isSessionValid(jwtWithExp(3600))).toBe(true);
      expect(isSessionValid(jwtWithExp(60), 5)).toBe(false);
      expect(isSessionValid('not.a.jwt')).toBe(false);
      expect(isSessionValid('')).toBe(false);
    });

    it('assumes opaque tokens are valid (Stytch checks server-side)', () => {
      expect(isSessionValid('opaque-session-token')).toBe(true);
    });
  });
});
