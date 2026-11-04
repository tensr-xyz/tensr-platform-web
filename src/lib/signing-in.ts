/**
 * "Signing you in…" spans a navigation: auth succeeds on /login (or a Stripe or invite return),
 * then /flow mounts. A short-lived session flag carries the state across the route change so
 * the screen never goes blank in between.
 */
export const SIGNING_IN_KEY = 'tensr-signing-in';
export const SIGNING_IN_MESSAGE = 'Signing you in…';
const MAX_AGE_MS = 60_000;

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function store(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function markSigningIn(storage: Store | null = store(), now = Date.now()): void {
  try {
    storage?.setItem(SIGNING_IN_KEY, String(now));
  } catch {
    // Without storage the login screen still shows the state; /flow just may not.
  }
}

export function clearSigningIn(storage: Store | null = store()): void {
  try {
    storage?.removeItem(SIGNING_IN_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** True while a sign-in is landing: the flag is fresh, or the URL is a Stripe or OAuth return. */
export function isSigningIn(
  storage: Store | null = store(),
  search = typeof window === 'undefined' ? '' : window.location.search,
  now = Date.now()
): boolean {
  if (isAuthReturn(new URLSearchParams(search))) return true;
  let raw: string | null = null;
  try {
    raw = storage?.getItem(SIGNING_IN_KEY) ?? null;
  } catch {
    raw = null;
  }
  const at = Number(raw);
  return Boolean(raw) && Number.isFinite(at) && now - at >= 0 && now - at < MAX_AGE_MS;
}

/** The URL itself says auth has already succeeded: an OAuth callback or a paid Stripe checkout. */
export function isAuthReturn(params: Pick<URLSearchParams, 'get'>): boolean {
  if (params.get('checkout') === 'success') return true;
  return params.get('stytch_token_type') === 'oauth' && Boolean(params.get('token'));
}
