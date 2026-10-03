import {
  inviteCreatedToast,
  inviteEmailLabel,
  isInvitationExpired,
  mapApiInvitation,
} from './organization-invitations';

function without(record: Record<string, unknown>, ...keys: string[]) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));
}

const apiInvitation = {
  id: 'inv-1',
  organization_id: 'org-1',
  email: 'ada@example.com',
  role: 'member',
  invited_by_user_id: 'user-1',
  status: 'PENDING',
  token: 'tok-1',
  expires_at: '2026-10-10T12:00:00+00:00',
  created_at: '2026-10-03T12:00:00+00:00',
  updated_at: '2026-10-03T12:00:01+00:00',
  email_status: 'sent',
  email_error: null,
  email_sent_at: '2026-10-03T12:00:01+00:00',
};

describe('mapApiInvitation', () => {
  it('maps the snake_case API record and owner/member roles', () => {
    expect(mapApiInvitation(apiInvitation)).toEqual({
      id: 'inv-1',
      organizationId: 'org-1',
      email: 'ada@example.com',
      role: 'MEMBER',
      invitedBy: 'user-1',
      status: 'PENDING',
      token: 'tok-1',
      expiresAt: '2026-10-10T12:00:00+00:00',
      createdAt: '2026-10-03T12:00:00+00:00',
      updatedAt: '2026-10-03T12:00:01+00:00',
      emailStatus: 'sent',
      emailError: null,
      emailSentAt: '2026-10-03T12:00:01+00:00',
    });
    expect(mapApiInvitation({ ...apiInvitation, role: 'owner' }).role).toBe('ADMIN');
  });

  it('marks invitations created before invite emails existed as unknown, not sent', () => {
    const inv = mapApiInvitation(
      without(apiInvitation, 'email_status', 'email_error', 'email_sent_at')
    );
    expect(inv.emailStatus).toBe('unknown');
    expect(inviteEmailLabel(inv)).toBe('No email on record');
  });
});

describe('inviteCreatedToast', () => {
  it('says emailed only when the API reports the email was sent', () => {
    const toast = inviteCreatedToast(mapApiInvitation(apiInvitation));
    expect(toast.title).toBe('Invitation emailed');
    expect(toast.variant).toBeUndefined();
  });

  it('reports a failed send with the reason', () => {
    const toast = inviteCreatedToast(
      mapApiInvitation({
        ...apiInvitation,
        email_status: 'failed',
        email_error: 'Email address is not verified',
      })
    );
    expect(toast.title).toBe('Invitation saved, but not emailed');
    expect(toast.description).toContain('Email address is not verified');
    expect(toast.variant).toBe('destructive');
  });

  it('does not claim an email was sent when the API predates invite emails', () => {
    const legacy = without(apiInvitation, 'email_status');
    expect(inviteCreatedToast(mapApiInvitation(legacy)).title).toBe(
      'Invitation saved, but not emailed'
    );
  });
});

describe('isInvitationExpired', () => {
  it('compares the expiry with now', () => {
    const inv = mapApiInvitation(apiInvitation);
    expect(isInvitationExpired(inv, new Date('2026-10-09T00:00:00Z'))).toBe(false);
    expect(isInvitationExpired(inv, new Date('2026-10-11T00:00:00Z'))).toBe(true);
  });
});
