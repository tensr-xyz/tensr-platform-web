import { isSessionUser } from './session-identity';

const me = { id: 'tensr-user-1', userId: 'user-test-stytch-1' };

describe('isSessionUser', () => {
  it('matches the session owner by tensr id when /me puts the Stytch id on userId', () => {
    expect(isSessionUser(me, 'tensr-user-1')).toBe(true);
  });

  it('still matches a profile that only has userId', () => {
    expect(isSessionUser({ userId: 'tensr-user-1' }, 'tensr-user-1')).toBe(true);
  });

  it('does not match another user or a missing id', () => {
    expect(isSessionUser(me, 'tensr-user-2')).toBe(false);
    expect(isSessionUser(me, undefined)).toBe(false);
    expect(isSessionUser(null, 'tensr-user-1')).toBe(false);
  });
});
