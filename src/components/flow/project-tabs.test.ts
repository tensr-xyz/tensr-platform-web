import {
  PROJECT_TABS,
  isProjectTabKey,
  markVisitedProjectTab,
  projectSectionPath,
  visibleProjectSection,
} from './project-tabs';

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

  it('tracks visited tabs without remounting on a repeat visit', () => {
    expect(isProjectTabKey('report')).toBe(true);
    expect(isProjectTabKey('interviews')).toBe(false);
    const first = markVisitedProjectTab(new Set(), 'chat');
    expect([...first]).toEqual(['chat']);
    const second = markVisitedProjectTab(first, 'report');
    expect([...second].sort()).toEqual(['chat', 'report']);
    expect(markVisitedProjectTab(second, 'report')).toBe(second);
    expect(markVisitedProjectTab(second, 'interviews')).toBe(second);
  });
});
