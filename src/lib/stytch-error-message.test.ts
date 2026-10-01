import { stytchErrorMessage } from './stytch-error-message';

/** Mirrors the shape of `StytchAPIError` thrown by @stytch/vanilla-js on any non-200. */
function stytchApiError(error_type: string, error_message: string, status_code = 400) {
  const err = new Error(
    `[${status_code}] ${error_type}\n${error_message}\nSee https://stytch.com/docs/api/errors/${status_code} for more information.\nrequest_id: request-id-test-123\n`
  );
  err.name = 'StytchAPIError';
  return Object.assign(err, { error_type, error_message, status_code });
}

describe('stytchErrorMessage', () => {
  it('maps a wrong or expired OTP to actionable copy', () => {
    expect(
      stytchErrorMessage(stytchApiError('otp_code_not_found', 'The OTP code could not be found.'))
    ).toBe('That code is incorrect or has expired. Check your email or request a new code.');
  });

  it('maps an invalid email', () => {
    expect(stytchErrorMessage(stytchApiError('invalid_email', 'Email format is invalid.'))).toBe(
      'Please enter a valid email address.'
    );
  });

  it('maps rate limiting', () => {
    expect(stytchErrorMessage(stytchApiError('too_many_requests', 'Too many requests.', 429))).toBe(
      'Too many attempts. Please wait a minute and try again.'
    );
  });

  it('maps a used or expired OAuth token (e.g. refreshing the callback URL)', () => {
    expect(
      stytchErrorMessage(stytchApiError('oauth_token_not_found', 'The OAuth token was not found.'))
    ).toBe('That sign-in link has expired. Please try signing in again.');
    expect(stytchErrorMessage(stytchApiError('pkce_mismatch', 'PKCE mismatch.'))).toBe(
      'That sign-in link has expired. Please try signing in again.'
    );
  });

  it("falls back to Stytch's human-readable error_message for unmapped types", () => {
    expect(
      stytchErrorMessage(stytchApiError('some_new_error', 'Something specific went wrong.'))
    ).toBe('Something specific went wrong.');
  });

  it('never leaks the raw multi-line SDK dump (status, docs URL, request_id)', () => {
    const message = stytchErrorMessage(stytchApiError('some_new_error', ''));
    expect(message).not.toMatch(/request_id|stytch\.com\/docs|\[400\]/);
    expect(message).toBe('Something went wrong. Please try again.');
  });

  it('maps an unreachable API to a connectivity message', () => {
    const err = new Error('Invalid or no response from server');
    err.name = 'StytchAPIUnreachableError';
    expect(stytchErrorMessage(err)).toBe(
      "We couldn't reach the sign-in service. Check your connection and try again."
    );
  });

  it('uses plain Error messages as-is and a custom fallback for unknown values', () => {
    expect(stytchErrorMessage(new Error('Stytch client not initialized'))).toBe(
      'Stytch client not initialized'
    );
    expect(stytchErrorMessage(undefined, 'Failed to continue with Google')).toBe(
      'Failed to continue with Google'
    );
  });
});
