const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

const EXPIRED_SIGN_IN = 'That sign-in link has expired. Please try signing in again.';

const MESSAGES_BY_ERROR_TYPE: Record<string, string> = {
  otp_code_not_found:
    'That code is incorrect or has expired. Check your email or request a new code.',
  invalid_email: 'Please enter a valid email address.',
  too_many_requests: 'Too many attempts. Please wait a minute and try again.',
  oauth_token_not_found: EXPIRED_SIGN_IN,
  pkce_mismatch: EXPIRED_SIGN_IN,
};

type StytchErrorLike = {
  name?: unknown;
  message?: unknown;
  error_type?: unknown;
  error_message?: unknown;
};

/**
 * User-facing copy for errors thrown by the Stytch SDK. `StytchAPIError.message`
 * is a multi-line dump (status, docs URL, request_id) and must not reach the UI.
 */
export function stytchErrorMessage(err: unknown, fallback = DEFAULT_MESSAGE): string {
  if (!err || typeof err !== 'object') return fallback;
  const e = err as StytchErrorLike;

  if (e.name === 'StytchAPIUnreachableError') {
    return "We couldn't reach the sign-in service. Check your connection and try again.";
  }

  if (typeof e.error_type === 'string') {
    const mapped = MESSAGES_BY_ERROR_TYPE[e.error_type];
    if (mapped) return mapped;
    if (typeof e.error_message === 'string' && e.error_message.trim()) {
      return e.error_message.trim();
    }
    return fallback;
  }

  if (typeof e.message === 'string' && e.message.trim() && !e.message.includes('\n')) {
    return e.message;
  }
  return fallback;
}
