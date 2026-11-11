import { PROJECT_TABS, projectSectionPath, visibleProjectSection } from './project-tabs';

describe('project tabs', () => {
  it('shows Chat, Sources, Responses, Tables and Report', () => {
    expect(PROJECT_TABS.map(([, label]) => label)).toEqual([
      'Chat',
      'Sources',
      'Responses',
      'Tables',
      'Report',
    ]);
  });

  it('opens an old Details link on Chat', () => {
    expect(visibleProjectSection('details')).toBe('chat');
    expect(projectSectionPath('study-1', 'details')).toBe('/flow/p/study-1/chat');
    expect(projectSectionPath('study-1', 'tables')).toBe('/flow/p/study-1/tables');
  });
});
