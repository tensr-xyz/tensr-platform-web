import { apiErrorDetail, mapApiMember, toApiRole } from './organization-members';

describe('mapApiMember', () => {
  it('maps the API member shape the members page reads', () => {
    expect(
      mapApiMember({
        organization_id: 'org-1',
        user_id: 'user-1',
        email: 'ada@example.com',
        display_name: null,
        role: 'owner',
        created_at: '2026-09-01T10:00:00+00:00',
      })
    ).toEqual({
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'ADMIN',
      joinedAt: '2026-09-01T10:00:00+00:00',
      user: { id: 'user-1', email: 'ada@example.com' },
    });
  });

  it('treats any non-owner role as MEMBER', () => {
    expect(mapApiMember({ user_id: 'u', role: 'member' }).role).toBe('MEMBER');
  });
});

describe('toApiRole', () => {
  it('sends only the roles the API accepts', () => {
    expect(toApiRole('ADMIN')).toBe('owner');
    expect(toApiRole('MEMBER')).toBe('member');
  });
});

describe('apiErrorDetail', () => {
  it('prefers the FastAPI detail string', () => {
    expect(apiErrorDetail({ detail: 'Member not found' }, 'Not Found')).toBe('Member not found');
  });

  it('falls back when detail is a validation list', () => {
    expect(apiErrorDetail({ detail: [{ msg: 'bad' }] }, 'Unprocessable Entity')).toBe(
      'Unprocessable Entity'
    );
  });
});
