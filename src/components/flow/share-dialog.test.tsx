import { render, screen } from '@testing-library/react';
import { ShareDialog } from './share-dialog';

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn((path: string) => {
    if (path === '/me') {
      return Promise.resolve({ active_organization: { id: 'org-1' } });
    }
    if (path.includes('/members') && path.includes('/projects/')) {
      return Promise.resolve({ members: [] });
    }
    if (path.includes('/organizations/')) {
      return Promise.resolve({ members: [], invitations: [] });
    }
    if (path.includes('/shares')) {
      return Promise.resolve({ shares: [] });
    }
    return Promise.resolve({});
  }),
}));

describe('ShareDialog', () => {
  it('shows Anyone with the link and Share one output only', async () => {
    render(<ShareDialog projectId="p1" projectName="Brand tracker" onClose={() => undefined} />);
    expect(await screen.findByText('Share Brand tracker')).toBeInTheDocument();
    expect(screen.getByText('Anyone with the link')).toBeInTheDocument();
    expect(screen.getByText('Share one output only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose' })).toBeInTheDocument();
  });

  it('offers Asker between Viewer and Editor', async () => {
    render(<ShareDialog projectId="p1" projectName="Brand tracker" onClose={() => undefined} />);
    expect(await screen.findByText('Share Brand tracker')).toBeInTheDocument();
    expect(screen.getByText(/Viewer · reads outputs/)).toBeInTheDocument();
    expect(screen.getByText(/Asker · asks questions/)).toBeInTheDocument();
    expect(screen.getByText(/Editor · runs and edits/)).toBeInTheDocument();
  });

  it('shows published link settings when a project link exists', async () => {
    const { flowJson } = jest.requireMock('@/lib/flow-api') as {
      flowJson: jest.Mock;
    };
    flowJson.mockImplementation((path: string) => {
      if (path === '/me') {
        return Promise.resolve({ active_organization: { id: 'org-1' } });
      }
      if (path.includes('/members') && path.includes('/projects/')) {
        return Promise.resolve({ members: [] });
      }
      if (path.includes('/organizations/')) {
        return Promise.resolve({ members: [], invitations: [] });
      }
      if (path.includes('/shares')) {
        return Promise.resolve({
          shares: [
            {
              id: 'share-1',
              token: 'tok-abc',
              kind: 'project_link',
              password_required: false,
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    render(<ShareDialog projectId="p1" projectName="Brand tracker" onClose={() => undefined} />);
    expect(await screen.findByText('Published link settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Password protect')).toBeInTheDocument();
    expect(screen.getByLabelText('Embed code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy embed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(screen.getByText('Viewer filters')).toBeInTheDocument();
  });
});
