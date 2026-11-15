import { PROJECT_TABS, projectSectionPath, visibleProjectSection } from './project-tabs';

describe('project tabs', () => {
  it('shows Chat, Sources, Responses, Tables and Report', () => {
    expect(PROJECT_TABS.map(([, label]) => label)).toEqual([
      'Chat',
      'Sources',
      'Details',
      'Responses',
      'Tables',
      'Report',
    ]);
  });

  it('opens Details on the details page', () => {
    expect(visibleProjectSection('details')).toBe('details');
    expect(projectSectionPath('study-1', 'details')).toBe('/flow/p/study-1/details');
    expect(projectSectionPath('study-1', 'tables')).toBe('/flow/p/study-1/tables');
  });
});
