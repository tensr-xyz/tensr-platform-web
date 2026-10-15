import { needsEmailFromResponse, NeedsEmailError } from './business-api';

describe('needsEmailFromResponse', () => {
  it('reads the needs_email payload', () => {
    const error = needsEmailFromResponse(
      409,
      JSON.stringify({
        detail: {
          code: 'needs_email',
          stytch_user_id: 'user-live-1',
          first_name: 'Oliver',
          last_name: 'Darby',
        },
      })
    );
    expect(error).toBeInstanceOf(NeedsEmailError);
    expect(error?.firstName).toBe('Oliver');
    expect(error?.stytchUserId).toBe('user-live-1');
  });

  it('ignores other responses', () => {
    expect(needsEmailFromResponse(500, 'nope')).toBeNull();
    expect(needsEmailFromResponse(409, JSON.stringify({ detail: 'taken' }))).toBeNull();
  });
});
