import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrganizationProvider, useOrganizationContext } from './index';
import { PERSONAL_ACCOUNT_KEY, saveActiveOrganisationId } from '@/lib/active-organisation';

jest.mock('@/hooks/api/use-auth', () => ({
  useAuth: () => ({
    user: { userId: 'u1' },
    isAuthenticated: true,
    isAuthReady: true,
    session: { sessionToken: 'sess-token' },
  }),
}));

const organisations = [
  { id: 'personal-1', name: 'Ada', is_personal: 1, role: 'owner' },
  { id: 'org-2', name: 'Prolific', is_personal: 0, role: 'member' },
];
let memberships: string[] = [];
const fetchMock = jest.fn();

function orgHeader(init?: RequestInit): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.['X-Organization-Id'];
}

function meRequests() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/me'));
}

function organisationRequests() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/organizations'));
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <OrganizationProvider>{children}</OrganizationProvider>
    </QueryClientProvider>
  );
}

async function renderProvider() {
  const { result } = renderHook(() => useOrganizationContext(), { wrapper });
  await waitFor(() => expect(result.current.userOrganizations).toHaveLength(2));
  return result;
}

describe('OrganizationProvider switchOrganization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    saveActiveOrganisationId(PERSONAL_ACCOUNT_KEY);
    memberships = ['personal-1', 'org-2'];
    fetchMock.mockImplementation(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      let body: unknown = {};
      if (path.includes('/api/organizations')) {
        body = { organizations: organisations.filter(org => memberships.includes(org.id)) };
      } else if (path.includes('/api/me')) {
        const requested = orgHeader(init);
        const id = requested && memberships.includes(requested) ? requested : 'personal-1';
        body = { active_organization: { id } };
      }
      return { ok: true, status: 200, json: async () => body } as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('opens the organisation once /api/me confirms it as the active organisation', async () => {
    const context = await renderProvider();

    await act(async () => {
      await context.current.switchOrganization('org-2');
    });

    expect(meRequests()).toHaveLength(1);
    expect(orgHeader(meRequests()[0][1])).toBe('org-2');
    expect(context.current.activeOrganization?.id).toBe('org-2');
    expect(context.current.isPersonalAccount).toBe(false);
    expect(localStorage.getItem('activeOrganizationId')).toBe('org-2');
  });

  it('fails the switch and refreshes the list when the API falls back to the personal org', async () => {
    const context = await renderProvider();
    memberships = ['personal-1'];
    const listRequestsBefore = organisationRequests().length;

    let failure: unknown;
    await act(async () => {
      await context.current.switchOrganization('org-2').catch(err => {
        failure = err;
      });
    });

    expect((failure as Error).message).toBe(
      "Couldn't switch to Prolific. You may no longer be a member."
    );
    expect(context.current.activeOrganization).toBeNull();
    expect(context.current.isPersonalAccount).toBe(true);
    expect(localStorage.getItem('activeOrganizationId')).not.toBe('org-2');
    await waitFor(() => expect(context.current.userOrganizations).toHaveLength(1));
    expect(organisationRequests().length).toBeGreaterThan(listRequestsBefore);
  });
});
