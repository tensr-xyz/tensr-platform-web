import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrganizationSettings from './organisation';

const toast = jest.fn();
const push = jest.fn();
const updateOrganization = jest.fn();
const deleteOrganization = jest.fn();
const mockUpdateProfile = jest.fn();
const mockSetUser = jest.fn();
const mockOrg = {
  id: 'org-1',
  name: 'Prolific',
  slug: 'prolific',
  settings: {},
  role: 'MEMBER' as 'ADMIN' | 'MEMBER',
  agentVersion: undefined as 'v1' | 'v2' | undefined,
};
const mockWorkspace = {
  org: mockOrg as typeof mockOrg | null,
  personal: false,
};
const mockUserState = {
  user: {
    userId: 'user-1',
    email: 'a@b.c',
    createdAt: '',
    updatedAt: '',
    status: 'ACTIVE',
    agentVersion: 'v1' as 'v1' | 'v2',
  },
  setUser: mockSetUser,
};

jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/hooks/ui/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
jest.mock('@/hooks/api/use-organisation', () => ({
  useOrganization: () => ({
    activeOrganization: mockWorkspace.org,
    updateOrganization,
    deleteOrganization,
    isLoading: false,
  }),
}));
jest.mock('@/contexts/organisation-context', () => ({
  useOptionalOrganizationContext: () => ({
    isPersonalAccount: mockWorkspace.personal,
    refreshCurrentOrganization: jest.fn(),
  }),
}));
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: typeof mockUserState) => unknown) => selector(mockUserState),
}));
jest.mock('@/lib/business-api', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

describe('OrganizationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrg.role = 'MEMBER';
    mockOrg.agentVersion = undefined;
    mockOrg.name = 'Prolific';
    mockWorkspace.org = mockOrg;
    mockWorkspace.personal = false;
    mockUserState.user.agentVersion = 'v1';
  });

  it('does not offer a URL slug field the API cannot save', () => {
    render(<OrganizationSettings />);

    expect(screen.getByLabelText('Organization Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('URL Slug')).not.toBeInTheDocument();
  });

  it('saves only the fields the API stores', async () => {
    updateOrganization.mockResolvedValue({ id: 'org-1', name: 'Prolific Research' });
    render(<OrganizationSettings />);

    fireEvent.change(screen.getByLabelText('Organization Name'), {
      target: { value: 'Prolific Research' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateOrganization).toHaveBeenCalledWith('org-1', { name: 'Prolific Research' })
    );
  });

  it('says datasets are still being removed after the organisation is deleted', async () => {
    deleteOrganization.mockResolvedValue(true);
    render(<OrganizationSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Organization' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        title: 'Organisation deleted',
        description: 'Its datasets are being removed.',
      })
    );
    expect(deleteOrganization).toHaveBeenCalledWith('org-1');
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('hides the agent version from members', () => {
    render(<OrganizationSettings />);
    expect(screen.queryByLabelText('Agent version')).not.toBeInTheDocument();
  });

  it('lets an admin set the agent version through the organisation update', async () => {
    mockOrg.role = 'ADMIN';
    updateOrganization.mockResolvedValue({
      ...mockOrg,
      agentVersion: 'v2',
    });
    render(<OrganizationSettings />);

    expect(screen.getByLabelText('Agent version')).toHaveValue('v1');
    fireEvent.change(screen.getByLabelText('Agent version'), { target: { value: 'v2' } });

    await waitFor(() =>
      expect(updateOrganization).toHaveBeenCalledWith('org-1', { agent_version: 'v2' })
    );
  });

  it('lets a personal workspace save the agent version on the user', async () => {
    mockWorkspace.org = null;
    mockWorkspace.personal = true;
    const saved = { ...mockUserState.user, agentVersion: 'v2' as const };
    mockUpdateProfile.mockResolvedValue(saved);
    render(<OrganizationSettings />);

    expect(screen.getByLabelText('Agent version')).toHaveValue('v1');
    fireEvent.change(screen.getByLabelText('Agent version'), { target: { value: 'v2' } });

    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ agentVersion: 'v2' }));
    expect(mockSetUser).toHaveBeenCalledWith(saved);
  });
});
