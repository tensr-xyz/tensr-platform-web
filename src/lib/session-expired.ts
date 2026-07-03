import { useAuthStore } from '@/stores/auth-store';
import { clearAuthData, getSessionJwt, getSessionToken } from '@/utils/auth';
import { authTrace } from '@/lib/auth-trace';

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

let handlingUnauthorized = false;

function hasSessionTokens(): boolean {
  return !!(getSessionJwt() || getSessionToken());
}

function canForceLogout(): boolean {
  const { isLoading, isInitialized } = useAuthStore.getState();
  return isInitialized && !isLoading;
}

/** Clear local auth and send the user to login (does not wait for auth bootstrap). */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/login')) return;

  clearAuthData();
  const store = useAuthStore.getState();
  store.logout();
  store.setSessionExpired(true);

  window.dispatchEvent(new CustomEvent('tensr:session-expired'));

  const returnTo = window.location.pathname + window.location.search;
  window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}

/** Clear local auth and send the user to login (idempotent). */
export function handleUnauthorized(source = 'unknown'): void {
  if (typeof window === 'undefined' || handlingUnauthorized) return;

  authTrace('handleUnauthorized:called', {
    source,
    canForceLogout: canForceLogout(),
    hasSessionTokens: hasSessionTokens(),
    stack: new Error().stack?.split('\n').slice(1, 6),
  });

  if (!canForceLogout()) {
    authTrace('handleUnauthorized:skipped', { source, reason: 'auth-not-ready' });
    return;
  }

  // A 401 while tokens still exist is usually a race (API fired before Stytch sync) — do not logout.
  if (hasSessionTokens()) {
    authTrace('handleUnauthorized:skipped', { source, reason: 'tokens-still-present' });
    return;
  }

  if (window.location.pathname.startsWith('/login')) return;

  handlingUnauthorized = true;

  authTrace('handleUnauthorized:redirecting', { source });
  redirectToLogin();
}

export function isUnauthorizedResponse(response: Response): boolean {
  return response.status === 401;
}

/** Call after fetch when status is known; returns true if session was cleared. */
export function handleUnauthorizedResponse(response: Response, source = 'fetch'): boolean {
  if (!isUnauthorizedResponse(response)) return false;

  authTrace('401-response', {
    source,
    url: response.url,
    canForceLogout: canForceLogout(),
    hasSessionTokens: hasSessionTokens(),
  });

  handleUnauthorized(source);
  return handlingUnauthorized;
}

export async function tensrAuthenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);
  handleUnauthorizedResponse(response, 'tensrAuthenticatedFetch');
  return response;
}
