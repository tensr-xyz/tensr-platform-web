const TOKEN_KEYS = {
  ACCESS_TOKEN: 'access_token',
  ID_TOKEN: 'id_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

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

export const isTokenValid = (token: string, bufferMinutes = 5) => {
  if (!token) return false;

  try {
    // Parse the JWT to get expiration
    const payload = JSON.parse(atob(token.split('.')[1]));

    if (!payload.exp) return false;

    // Convert to milliseconds and add buffer
    const expiryTime = payload.exp * 1000;
    const bufferMs = bufferMinutes * 60 * 1000;

    // Return true if token is still valid with buffer
    return Date.now() < expiryTime - bufferMs;
  } catch (e) {
    console.error('Error validating token:', e);
    return false;
  }
};

export const storeTokens = (accessToken: string, idToken: string, refreshToken: string) => {
  if (typeof window === 'undefined') return;

  try {
    // Store in localStorage (keep existing behavior)
    localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(TOKEN_KEYS.ID_TOKEN, idToken);
    localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken);

    // Also store in cookies for middleware
    setCookie('accessToken', accessToken, 1); // 1 day
    setCookie('idToken', idToken, 1); // 1 day
    setCookie('refreshToken', refreshToken, 7); // 7 days

    console.log('Tokens stored in localStorage and cookies');
  } catch (error) {
    console.error('Error storing tokens:', error);
  }
};

export const removeTokens = () => {
  if (typeof window === 'undefined') return;

  try {
    // Remove from localStorage
    Object.values(TOKEN_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });

    // Remove from cookies
    removeCookie('accessToken');
    removeCookie('idToken');
    removeCookie('refreshToken');
  } catch (error) {
    console.error('Error removing tokens:', error);
  }
};

export const getAccessToken = () => {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN);
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
};

export const getIdToken = () => {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(TOKEN_KEYS.ID_TOKEN);
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
};

export const getRefreshToken = () => {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN);
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
};

export const getStoredTokens = () => {
  if (typeof window === 'undefined') return null;

  const accessToken = localStorage.getItem('access_token');
  const idToken = localStorage.getItem('id_token');
  const refreshToken = localStorage.getItem('refresh_token');

  if (!accessToken || !idToken) return null;

  return {
    accessToken,
    idToken,
    refreshToken,
  };
};

export const clearAuthData = () => {
  removeTokens();
  if (typeof window !== 'undefined') {
    // Clear any other auth-related items from localStorage/sessionStorage
    localStorage.removeItem('auth_session');
    sessionStorage.clear();
  }
};
