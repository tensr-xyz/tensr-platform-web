jest.mock('@/components/flow/flow-shell', () => ({ memberInitials: () => 'XX' }));
jest.mock('@/lib/flow-api', () => ({ flowJson: jest.fn() }));
jest.mock('@/hooks/api/use-auth', () => ({ useAuth: () => ({ handleLogout: jest.fn() }) }));
jest.mock('@/contexts/organisation-context', () => ({ useOrganizationContext: jest.fn() }));

import { settingsSection } from '@/components/flow/settings-screen';
import { pendingInvitations } from './organisation';
import { pickTeam, type Team } from './teams';
import type { OrganizationInvitation } from '@/lib/organization-invitations';

describe('settings sections', () => {
  it('maps members onto organisation and defaults to general', () => {
    expect(settingsSection('members')).toBe('organisation');
    expect(settingsSection('teams')).toBe('teams');
    expect(settingsSection('nope')).toBe('general');
    expect(settingsSection()).toBe('general');
  });
});

describe('pending invitations', () => {
  const invite = (email: string, status: OrganizationInvitation['status'], expiresAt: string) =>
    ({ email, status, expiresAt }) as OrganizationInvitation;
  it('keeps live pending invites for people who are not members yet', () => {
    const now = new Date('2026-11-03T00:00:00Z');
    const list = [
      invite('new@x.com', 'PENDING', '2026-11-08T00:00:00Z'),
      invite('old@x.com', 'PENDING', '2026-11-01T00:00:00Z'),
      invite('done@x.com', 'ACCEPTED', '2026-11-08T00:00:00Z'),
      invite('Member@x.com', 'PENDING', '2026-11-08T00:00:00Z'),
    ];
    const members = [
      { userId: 'u', email: 'member@x.com', name: 'm', role: 'member' as const, joinedAt: '' },
    ];
    expect(pendingInvitations(list, members, now).map(i => i.email)).toEqual(['new@x.com']);
  });
});

describe('team picker', () => {
  const teams: Team[] = [
    { id: 'a', name: 'A', role: 'member', people: [] },
    { id: 'b', name: 'B', role: 'owner', people: [] },
  ];
  it('prefers the chosen team, then the active workspace, then the first', () => {
    expect(pickTeam(teams, 'b', 'a')?.id).toBe('b');
    expect(pickTeam(teams, '', 'b')?.id).toBe('b');
    expect(pickTeam(teams, '', 'zzz')?.id).toBe('a');
    expect(pickTeam([], '', '')).toBeNull();
  });
});
