import { devLog } from '@/lib/dev-log';
import { STYTCH_SESSION_COOKIE_DAYS } from '@/lib/stytch-session';
const SESSION_TOKEN_KEY = 'stytch_session_token';
const SESSION_JWT_KEY = 'stytch_session_jwt';
const REFRESH_TOKEN_KEY = 'stytch_refresh_token';
const ACCESS_TOKEN_KEY = 'stytch_access_token';
const ID_TOKEN_KEY = 'stytch_id_token';

/**
 * Session cookies must be SameSite=Lax (not Strict).
 * Stripe Checkout returns via a cross-site top-level GET; Strict cookies are
 * omitted on that request, so middleware sees no session and bounce-loops
 * /dashboard → /login even though the user just paid.
 * Secure is set on HTTPS so browsers treat the cookie as a modern session cookie.
 */
const cookieSecurityAttrs = (): string => {
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? ';Secure' : '';
  return `;path=/;SameSite=Lax${secure}`;
};

// Cookie helper functions
const setCookie = (name: string, value: string, days: number = STYTCH_SESSION_COOKIE_DAYS) => {
  if (typeof window === 'undefined') return;

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()}${cookieSecurityAttrs()}`;
};

const removeCookie = (name: string) => {
  if (typeof window === 'undefined') return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT${cookieSecurityAttrs()}`;
};

export const isSessionValid = (sessionToken: string, bufferMinutes = 5) => {
  if (!sessionToken) return false;

  // Check if it's a JWT
  const parts = sessionToken.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false;

      const expiryTime = payload.exp * 1000;
      const bufferMs = bufferMinutes * 60 * 1000;
      return Date.now() < expiryTime - bufferMs;
    } catch (e) {
      console.error('Error validating session token:', e);
      return false;
    }
  }

  // For non-JWT tokens, assume valid (Stytch handles expiry server-side)
  return true;
};

/**
 * Persist Stytch credentials to localStorage and HTTP cookies (used by middleware and API).
 * Call after login and whenever `stytch.session.getTokens()` returns refreshed values.
 */
export const storeSession = (sessionToken: string, sessionJwt?: string) => {
  if (typeof window === 'undefined') {
    devLog('storeSession called on server side, skipping');
    return;
  }

  devLog('storeSession called on client side');

  try {
    localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    if (sessionJwt) {
      localStorage.setItem(SESSION_JWT_KEY, sessionJwt);
    }

    setCookie('stytch_session_token', sessionToken, STYTCH_SESSION_COOKIE_DAYS);
    if (sessionJwt) {
      setCookie('stytch_session_jwt', sessionJwt, STYTCH_SESSION_COOKIE_DAYS);
    }

    devLog('Session stored successfully');
  } catch (error) {
    console.error('Error storing session:', error);
  }
};

type StytchTokenSource = {
  session: {
    getTokens: () => { session_token?: string; session_jwt?: string } | null | undefined;
  };
};

/** Read fresh tokens from the Stytch SDK and mirror them to localStorage + cookies. */
export function persistStytchTokensFromSdk(
  stytch: StytchTokenSource | null | undefined
): { sessionToken: string; sessionJwt?: string } | null {
  const tokens = stytch?.session.getTokens();
  if (!tokens?.session_token) return null;

  if (!tokens.session_jwt) {
    const hadStoredJwt = typeof window !== 'undefined' && !!localStorage.getItem(SESSION_JWT_KEY);
    console.warn(
      '[tensr/auth] getTokens() returned session_token without session_jwt; stytch_session_jwt cookie was not updated.',
      { hadStoredJwt }
    );
  }

  storeSession(tokens.session_token, tokens.session_jwt);
  return {
    sessionToken: tokens.session_token,
    sessionJwt: tokens.session_jwt,
  };
}

export const removeSession = () => {
  if (typeof window === 'undefined') return;

  try {
    // Remove from localStorage
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_JWT_KEY);

    // Remove from cookies
    removeCookie('stytch_session_token');
    removeCookie('stytch_session_jwt');
    removeCookie('stytch_session');
  } catch (error) {
    console.error('Error removing session:', error);
  }
};

export const getSessionToken = () => {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting session token:', error);
    return null;
  }
};

export const getSessionJwt = () => {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(SESSION_JWT_KEY);
  } catch (error) {
    console.error('Error getting session JWT:', error);
    return null;
  }
};

/** Stytch credential for tensr-api `Authorization: Bearer …` (JWT preferred; opaque session token fallback). */
export function getStytchBearerForTensrApi(): string | null {
  const jwt = getSessionJwt();
  if (jwt) return jwt;
  return getSessionToken();
}

export const getStoredSession = () => {
  if (typeof window === 'undefined') return null;

  const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
  const sessionJwt = localStorage.getItem(SESSION_JWT_KEY);

  if (!sessionToken) return null;

  return {
    sessionToken,
    sessionJwt,
  };
};

export const clearAuthData = () => {
  removeSession();
  if (typeof window !== 'undefined') {
    // Clear any other auth-related items from localStorage/sessionStorage
    localStorage.removeItem('auth_session');
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ID_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    removeCookie('stytch_access_token');
    removeCookie('stytch_id_token');
    removeCookie('stytch_refresh_token');
    sessionStorage.clear();
  }
};

export const decodeSessionJwt = (sessionJwt: string) => {
  try {
    const base64Url = sessionJwt.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding session JWT:', error);
    return null;
  }
};

// Legacy aliases for backward compatibility
export const getIdToken = getSessionJwt;
export const getAccessToken = getSessionToken;

const PERSONAL_ACCOUNT_KEY = 'PERSONAL_ACCOUNT';

/** Auth + active organization headers for tensr-api dataset/project routes. */
export function getTensrApiHeaders(extra?: HeadersInit): HeadersInit {
  const token = getStytchBearerForTensrApi();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (typeof window !== 'undefined') {
    const orgId = localStorage.getItem('activeOrganizationId');
    if (orgId && orgId !== PERSONAL_ACCOUNT_KEY) {
      headers['X-Organization-Id'] = orgId;
    }
  }

  return {
    ...headers,
    ...(extra as Record<string, string> | undefined),
  };
}
export const decodeIdToken = decodeSessionJwt;

// Get eligible plans from token — all paid checkout tiers (education is manual only).
export const getEligiblePlans = (_idToken?: string | null): string[] => {
  return ['pro', 'pro_plus', 'teams'];
};

// Get refresh token
export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
};

// Store tokens (access token, id token, refresh token)
export const storeTokens = (accessToken: string, idToken: string, refreshToken: string) => {
  if (typeof window === 'undefined') {
    devLog('storeTokens called on server side, skipping');
    return;
  }

  try {
    // Store in localStorage
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(ID_TOKEN_KEY, idToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

    // Also store in cookies for middleware
    setCookie('stytch_access_token', accessToken, STYTCH_SESSION_COOKIE_DAYS);
    setCookie('stytch_id_token', idToken, STYTCH_SESSION_COOKIE_DAYS);
    setCookie('stytch_refresh_token', refreshToken, STYTCH_SESSION_COOKIE_DAYS);

    devLog('Tokens stored successfully');
  } catch (error) {
    console.error('Error storing tokens:', error);
  }
};
