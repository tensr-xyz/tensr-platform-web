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

  it('offers Can ask between Can edit and Can view', async () => {
    render(<ShareDialog projectId="p1" projectName="Brand tracker" onClose={() => undefined} />);
    expect(await screen.findByText('Share Brand tracker')).toBeInTheDocument();
    expect(screen.getByText(/Can edit · runs and edits/)).toBeInTheDocument();
    expect(screen.getByText(/Can ask · asks questions/)).toBeInTheDocument();
    expect(screen.getByText(/Can view · reads outputs/)).toBeInTheDocument();
  });
});
