import { render, screen } from '@testing-library/react';
import { ProjectPresenceAvatars } from '@/components/flow/project-presence';
import type { ProjectPresenceView } from '@/components/flow/project-presence-logic';

describe('ProjectPresenceAvatars', () => {
  it('renders Paper 9f avatars, overflow, status, and name tooltip target', () => {
    const view: ProjectPresenceView = {
      avatars: [
        {
          userId: 'u2',
          userName: 'Priya Shah',
          page: 'report',
          initials: 'PS',
          tone: { background: '#F3E6D8', color: '#A15C12' },
        },
        {
          userId: 'u3',
          userName: 'Alex Kim',
          page: 'chat',
          initials: 'AK',
          tone: { background: '#E8F1ED', color: '#1E6B58' },
        },
      ],
      overflow: 1,
      status: 'Priya is on Report',
    };

    render(<ProjectPresenceAvatars view={view} />);

    expect(screen.getByLabelText('People in this project')).toBeTruthy();
    expect(screen.getByText('PS')).toBeTruthy();
    expect(screen.getByText('AK')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText('Priya is on Report')).toBeTruthy();
  });

  it('renders nothing when the roster is empty', () => {
    const { container } = render(
      <ProjectPresenceAvatars view={{ avatars: [], overflow: 0, status: null }} />
    );
    expect(container.firstChild).toBeNull();
  });
});
