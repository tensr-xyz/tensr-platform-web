import { accountInitials, accountLabel } from './user-label';

describe('accountLabel', () => {
  it('uses the name when one is present', () => {
    expect(accountLabel({ firstName: 'Oliver', lastName: 'Darby', email: '' })).toBe(
      'Oliver Darby'
    );
  });

  it('uses the email when the name is missing', () => {
    expect(accountLabel({ firstName: null, lastName: null, email: 'ada@example.com' })).toBe(
      'ada@example.com'
    );
  });

  it('returns null when both are blank', () => {
    expect(accountLabel({ email: '  ' })).toBeNull();
  });
});

describe('accountInitials', () => {
  it('takes initials from the name', () => {
    expect(accountInitials({ firstName: 'Oliver', lastName: 'Darby', email: '' })).toBe('OD');
  });

  it('takes initials from the email when there is no name', () => {
    expect(accountInitials({ email: 'ada.lovelace@example.com' })).toBe('AL');
  });

  it('returns null when there is nothing to abbreviate', () => {
    expect(accountInitials({ email: '' })).toBeNull();
  });
});
