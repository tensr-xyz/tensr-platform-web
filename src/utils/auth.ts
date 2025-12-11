const SESSION_TOKEN_KEY = 'stytch_session_token';
const SESSION_JWT_KEY = 'stytch_session_jwt';
const REFRESH_TOKEN_KEY = 'stytch_refresh_token';
const ACCESS_TOKEN_KEY = 'stytch_access_token';
const ID_TOKEN_KEY = 'stytch_id_token';

// Cookie helper functions
const setCookie = (name: string, value: string, days: number = 7) => {
  if (typeof window === 'undefined') return;

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
};

const removeCookie = (name: string) => {
  if (typeof window === 'undefined') return;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Strict`;
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

export const storeSession = (sessionToken: string, sessionJwt?: string) => {
  if (typeof window === 'undefined') {
    console.log('storeSession called on server side, skipping');
    return;
  }

  console.log('storeSession called on client side');

  try {
    // Store in localStorage
    localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    if (sessionJwt) {
      localStorage.setItem(SESSION_JWT_KEY, sessionJwt);
    }

    // Also store in cookies for middleware
    setCookie('stytch_session_token', sessionToken, 7);
    if (sessionJwt) {
      setCookie('stytch_session_jwt', sessionJwt, 7);
    }

    console.log('Session stored successfully');
  } catch (error) {
    console.error('Error storing session:', error);
  }
};

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
export const decodeIdToken = decodeSessionJwt;

// Get eligible plans from token (stub - returns all paid plans since free tier removed)
export const getEligiblePlans = (idToken?: string | null): string[] => {
  // Since free tier is removed, return all paid plans
  // In a real implementation, this might check token claims for restrictions
  return ['pro', 'team', 'enterprise'];
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
    console.log('storeTokens called on server side, skipping');
    return;
  }

  try {
    // Store in localStorage
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(ID_TOKEN_KEY, idToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

    // Also store in cookies for middleware
    setCookie('stytch_access_token', accessToken, 7);
    setCookie('stytch_id_token', idToken, 7);
    setCookie('stytch_refresh_token', refreshToken, 7);

    console.log('Tokens stored successfully');
  } catch (error) {
    console.error('Error storing tokens:', error);
  }
};
