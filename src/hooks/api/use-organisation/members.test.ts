import { act, renderHook } from '@testing-library/react';
import { useOrganization } from './index';

jest.mock('@/hooks/api/use-auth', () => ({ useAuth: () => ({}) }));
jest.mock('@/utils/auth', () => ({
  ...jest.requireActual('@/utils/auth'),
  getIdToken: () => 'test-token',
}));

let orgContext: { activeOrganization: unknown; isPersonalAccount: boolean } | null = null;
jest.mock('@/contexts/organisation-context', () => ({
  useOptionalOrganizationContext: () => orgContext,
}));

const prolific = {
  id: 'org-1',
  name: 'Prolific',
  role: 'ADMIN',
  createdAt: '2026-09-01T10:00:00+00:00',
  updatedAt: '2026-09-01T10:00:00+00:00',
};

const apiMember = {
  organization_id: 'org-1',
  user_id: 'user-1',
  email: 'ada@example.com',
  role: 'member',
  created_at: '2026-09-01T10:00:00+00:00',
};

function respond(status: number, body: unknown) {
  return Promise.resolve({
    ok: status < 400,
    status,
    statusText: status === 404 ? 'Not Found' : 'OK',
    json: () => Promise.resolve(body),
  } as Response);
}

describe('useOrganization members', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    orgContext = null;
    localStorage.clear();
  });

  it('uses the organisation the provider switched to', () => {
    orgContext = { activeOrganization: prolific, isPersonalAccount: false };
    const { result } = renderHook(() => useOrganization());
    expect(result.current.activeOrganization).toBe(prolific);
  });

  it('has no organisation on the personal account', () => {
    orgContext = { activeOrganization: prolific, isPersonalAccount: true };
    const { result } = renderHook(() => useOrganization());
    expect(result.current.activeOrganization).toBeNull();
  });

  it('cancels an invitation inside the active organisation', async () => {
    localStorage.setItem('activeOrganizationId', 'org-1');
    fetchMock.mockReturnValueOnce(respond(200, { cancelled: true }));
    const { result } = renderHook(() => useOrganization());

    await act(async () => {
      await result.current.deleteInvitation('tok-1');
    });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/invitations\/tok-1$/);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer test-token',
      'X-Organization-Id': 'org-1',
    });
  });

  it('maps fetched members so remove uses the real user id', async () => {
    fetchMock
      .mockReturnValueOnce(respond(200, { members: [apiMember], seats: null }))
      .mockReturnValueOnce(respond(200, { removed: true }));
    const { result } = renderHook(() => useOrganization());

    await act(async () => {
      await result.current.fetchMembers('org-1');
    });
    expect(result.current.members[0]).toMatchObject({
      userId: 'user-1',
      role: 'MEMBER',
      user: { email: 'ada@example.com' },
    });

    await act(async () => {
      await result.current.removeMember('org-1', result.current.members[0].userId);
    });
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/organizations\/org-1\/members\/user-1$/);
    expect(result.current.members).toEqual([]);
  });

  it('keeps fetchMembers stable across renders', () => {
    const { result, rerender } = renderHook(() => useOrganization());
    const first = result.current.fetchMembers;
    rerender();
    expect(result.current.fetchMembers).toBe(first);
  });

  it('sends owner/member when changing a role', async () => {
    fetchMock.mockReturnValueOnce(respond(200, { member: { ...apiMember, role: 'owner' } }));
    const { result } = renderHook(() => useOrganization());

    let updated: Awaited<ReturnType<typeof result.current.updateMemberRole>> | undefined;
    await act(async () => {
      updated = await result.current.updateMemberRole('org-1', 'user-1', 'ADMIN');
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ role: 'owner' });
    expect(updated).toMatchObject({ userId: 'user-1', role: 'ADMIN' });
  });

  it('surfaces the API reason when remove fails', async () => {
    fetchMock.mockReturnValueOnce(
      respond(404, { detail: 'Member not found in this organization' })
    );
    const { result } = renderHook(() => useOrganization());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.removeMember('org-1', 'nobody');
      } catch (err) {
        caught = err;
      }
    });
    expect((caught as Error).message).toBe(
      'Failed to remove member: Member not found in this organization'
    );
  });
});
