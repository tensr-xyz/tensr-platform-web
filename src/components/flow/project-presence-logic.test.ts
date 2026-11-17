import { memberInitials } from '@/components/flow/flow-shell';
import {
  buildProjectPresenceView,
  projectPresenceFirstName,
  projectPresencePageLabel,
} from '@/components/flow/project-presence-logic';

describe('project presence (Paper 9f)', () => {
  it('maps tab keys to labels and short names', () => {
    expect(projectPresencePageLabel('report')).toBe('Report');
    expect(projectPresencePageLabel('tables')).toBe('Tables');
    expect(projectPresenceFirstName('Priya Shah')).toBe('Priya');
    expect(projectPresenceFirstName('priya@example.com')).toBe('Priya');
  });

  it('builds avatars for others with status and overflow', () => {
    const view = buildProjectPresenceView(
      [
        {
          userId: 'me',
          userName: 'Ollie Darby',
          page: 'tables',
          lastActive: 30,
        },
        {
          userId: 'u2',
          userName: 'Priya Shah',
          page: 'report',
          lastActive: 20,
        },
        {
          userId: 'u3',
          userName: 'Alex Kim',
          page: 'chat',
          lastActive: 10,
        },
        {
          userId: 'u4',
          userName: 'Sam Lee',
          page: 'sources',
          lastActive: 5,
        },
      ],
      'me',
      memberInitials,
      2
    );

    expect(view.avatars.map(row => row.initials)).toEqual(['PS', 'AK']);
    expect(view.overflow).toBe(1);
    expect(view.status).toBe('Priya is on Report');
    expect(view.avatars[0]?.userName).toBe('Priya Shah');
  });

  it('hides when nobody else is present', () => {
    const view = buildProjectPresenceView(
      [{ userId: 'me', userName: 'Ollie', page: 'chat', lastActive: 1 }],
      'me',
      memberInitials
    );
    expect(view.avatars).toEqual([]);
    expect(view.overflow).toBe(0);
    expect(view.status).toBeNull();
  });
});
