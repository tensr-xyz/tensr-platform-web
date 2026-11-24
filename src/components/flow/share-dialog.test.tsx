import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('offers signed-in and anonymous link modes when a project link is on', async () => {
    const { flowJson } = jest.requireMock('@/lib/flow-api') as {
      flowJson: jest.Mock;
    };
    flowJson.mockImplementation((path: string) => {
      if (path === '/me') {
        return Promise.resolve({ active_organization: { id: 'org-1', name: 'Acme' } });
      }
      if (path.includes('/members') && path.includes('/projects/')) {
        return Promise.resolve({ members: [] });
      }
      if (path.includes('/organizations/')) {
        return Promise.resolve({ members: [], invitations: [] });
      }
      if (path.includes('/overview')) {
        return Promise.resolve({ report: { pages: [] } });
      }
      if (path.includes('/shares')) {
        return Promise.resolve({
          shares: [
            {
              id: 'share-1',
              token: 'tok-abc',
              kind: 'project_link',
              access: 'anonymous',
              password_required: false,
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    render(<ShareDialog projectId="p1" projectName="Brand tracker" onClose={() => undefined} />);
    expect(await screen.findByRole('radiogroup', { name: 'Link access' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Anyone, no sign-in/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Signed-in people in Acme/ })).toBeInTheDocument();
    expect(screen.getByText(/Expires: never/)).toBeInTheDocument();
  });

  it('offers Can ask between Can view and Can edit', async () => {
    render(<ShareDialog projectId="p1" projectName="Brand tracker" onClose={() => undefined} />);
    expect(await screen.findByText('Share Brand tracker')).toBeInTheDocument();
    expect(screen.getByText(/Can view · reads outputs/)).toBeInTheDocument();
    expect(screen.getByText(/Can ask · asks questions/)).toBeInTheDocument();
    expect(screen.getByText(/Can edit · runs and edits/)).toBeInTheDocument();
  });

  it('lists pending project invites with role, resend and revoke', async () => {
    const { flowJson } = jest.requireMock('@/lib/flow-api') as {
      flowJson: jest.Mock;
    };
    flowJson.mockImplementation((path: string) => {
      if (path === '/me') {
        return Promise.resolve({ active_organization: { id: 'org-1', name: 'Acme' } });
      }
      if (path.includes('/members') && path.includes('/projects/')) {
        return Promise.resolve({
          members: [{ user_id: 'owner-1', role: 'owner' }],
        });
      }
      if (path.includes('/organizations/') && path.includes('/members')) {
        return Promise.resolve({
          members: [{ user_id: 'owner-1', email: 'owner@example.com', display_name: 'Owner' }],
        });
      }
      if (path.includes('/invitations') && !path.includes('resend')) {
        return Promise.resolve({
          invitations: [
            {
              id: 'inv-1',
              email: 'asker@example.com',
              status: 'PENDING',
              token: 'tok-ask',
              project_id: 'p1',
              project_role: 'asker',
              created_at: new Date().toISOString(),
              email_status: 'sent',
            },
            {
              id: 'inv-other',
              email: 'other@example.com',
              status: 'PENDING',
              token: 'tok-other',
              project_id: 'other-project',
              project_role: 'viewer',
            },
            {
              id: 'inv-legacy',
              email: 'legacy@example.com',
              status: 'pending',
              token: 'tok-legacy',
            },
          ],
        });
      }
      if (path.includes('/shares')) {
        return Promise.resolve({ shares: [] });
      }
      return Promise.resolve({});
    });

    render(<ShareDialog projectId="p1" projectName="Brand tracker" onClose={() => undefined} />);
    expect(await screen.findByText('asker@example.com')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getAllByText('Can ask').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(screen.getByText(/People with access · 2/)).toBeInTheDocument();
    expect(screen.queryByText('other@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('legacy@example.com')).not.toBeInTheDocument();
  });

  it('posts project_id and project_role when inviting by email', async () => {
    const { flowJson } = jest.requireMock('@/lib/flow-api') as {
      flowJson: jest.Mock;
    };
    const calls: { path: string; init?: RequestInit }[] = [];
    flowJson.mockImplementation((path: string, init?: RequestInit) => {
      calls.push({ path, init });
      if (path === '/me') {
        return Promise.resolve({ active_organization: { id: 'org-1' } });
      }
      if (path.includes('/members') && path.includes('/projects/')) {
        return Promise.resolve({ members: [] });
      }
      if (path.includes('/organizations/') && path.includes('/members')) {
        return Promise.resolve({ members: [] });
      }
      if (path.includes('/invitations') && init?.method === 'POST') {
        return Promise.resolve({
          invitation: {
            id: 'inv-new',
            email: 'new@example.com',
            status: 'PENDING',
            token: 'tok-new',
            project_id: 'p1',
            project_role: 'asker',
            email_status: 'sent',
          },
        });
      }
      if (path.includes('/invitations')) {
        return Promise.resolve({ invitations: [] });
      }
      if (path.includes('/shares')) {
        return Promise.resolve({ shares: [] });
      }
      return Promise.resolve({});
    });

    render(<ShareDialog projectId="p1" projectName="Brand tracker" onClose={() => undefined} />);
    const email = await screen.findByLabelText('Email');
    fireEvent.change(email, { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));

    await waitFor(() => {
      const inviteCall = calls.find(
        call =>
          call.path.includes('/organizations/org-1/invitations') && call.init?.method === 'POST'
      );
      expect(inviteCall).toBeTruthy();
      const body = JSON.parse(String(inviteCall?.init?.body || '{}')) as Record<string, string>;
      expect(body).toMatchObject({
        email: 'new@example.com',
        role: 'member',
        project_id: 'p1',
        project_role: 'asker',
      });
    });
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

  it('keeps Done outside the scroll body so the action stays pinned', async () => {
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
    const settings = await screen.findByText('Published link settings');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    const dialog = document.body.querySelector('.share-dialog');
    const scroll = document.body.querySelector('.share-scroll');
    const foot = document.body.querySelector('.share-foot');
    expect(dialog?.classList.contains('flow-modal')).toBe(true);
    expect(scroll).toBeTruthy();
    expect(foot).toBeTruthy();
    expect(scroll?.contains(foot)).toBe(false);
    expect(scroll?.contains(settings)).toBe(true);
  });
});
