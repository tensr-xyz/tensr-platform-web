import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrganizationSettings from './organisation';

const toast = jest.fn();
const push = jest.fn();
const updateOrganization = jest.fn();
const deleteOrganization = jest.fn();
const activeOrganization = { id: 'org-1', name: 'Prolific', slug: 'prolific', settings: {} };

jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/hooks/ui/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
jest.mock('@/hooks/api/use-organisation', () => ({
  useOrganization: () => ({
    activeOrganization,
    updateOrganization,
    deleteOrganization,
    isLoading: false,
  }),
}));

describe('OrganizationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
