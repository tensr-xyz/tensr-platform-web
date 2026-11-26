import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NewProjectDialog } from './flow-shell';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/hooks/api/use-auth', () => ({
  useAuth: () => ({ handleLogout: jest.fn() }),
}));

jest.mock('@/utils/auth', () => ({
  getStytchBearerForTensrApi: () => null,
}));

jest.mock('@/lib/flow-api', () => ({
  flowJson: jest.fn(),
}));

describe('NewProjectDialog (TEN-268)', () => {
  const fifteenProjects = Array.from({ length: 15 }, (_, i) => ({
    id: `p${i + 1}`,
    kind: 'project' as const,
    title: `Study ${i + 1} (copy setup)`,
    blurb:
      'Keeps weights, derived questions, banners, recipes and report layout. Leaves data behind.',
  }));

  beforeEach(() => {
    push.mockReset();
    const { flowJson } = jest.requireMock('@/lib/flow-api') as { flowJson: jest.Mock };
    flowJson.mockImplementation((path: string) => {
      if (path === '/api/projects/start-options') {
        return Promise.resolve({
          blank: {
            kind: 'blank',
            title: 'Blank project',
            blurb: 'Upload data and start from scratch',
          },
          projects: fifteenProjects,
          templates: [
            {
              id: 't1',
              kind: 'template',
              title: 'Team template · Ad-hoc U&A study',
              blurb: 'Saved by your team · 3 recipes · house report style',
            },
          ],
          then_note: 'Upload the new wave.',
        });
      }
      return Promise.resolve({});
    });
  });

  it('uses the capped flow-modal shell and collapses 15 copy-setup projects', async () => {
    render(
      <NewProjectDialog
        open
        onOpenChange={() => undefined}
        folders={[]}
        datasets={[]}
        defaultFolder={null}
        onCreated={async () => undefined}
      />
    );

    expect(await screen.findByRole('heading', { name: 'New project' })).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog.classList.contains('flow-modal')).toBe(true);
    expect(dialog.classList.contains('new-project-dialog')).toBe(true);

    expect(screen.getByRole('radio', { name: /Blank project/i })).toBeInTheDocument();

    const toggle = await screen.findByRole('button', {
      name: /Copy another project.s setup/i,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(toggle).getByText('15 projects · ▾')).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /Study 1 \(copy setup\)/i })
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /Study 1 \(copy setup\)/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('radio', { name: /Study 15 \(copy setup\)/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Team template/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
