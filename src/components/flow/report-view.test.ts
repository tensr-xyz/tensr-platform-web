import {
  initialReportView,
  readStoredReportView,
  reportViewFromPaneParam,
  reportViewStorageKey,
  writeStoredReportView,
} from '@/components/flow/report-view';

describe('reportViewFromPaneParam', () => {
  it('maps legacy report to overview and keeps slides/outputs', () => {
    expect(reportViewFromPaneParam('outputs')).toBe('outputs');
    expect(reportViewFromPaneParam('slides')).toBe('slides');
    expect(reportViewFromPaneParam('overview')).toBe('overview');
    expect(reportViewFromPaneParam('report')).toBe('overview');
    expect(reportViewFromPaneParam(null)).toBeNull();
    expect(reportViewFromPaneParam('other')).toBeNull();
  });
});

describe('report view storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads and writes the last view per project', () => {
    expect(reportViewStorageKey('p1')).toBe('tensr-report-view:p1');
    expect(readStoredReportView('p1')).toBeNull();
    writeStoredReportView('p1', 'slides');
    expect(readStoredReportView('p1')).toBe('slides');
    expect(readStoredReportView('p2')).toBeNull();
  });

  it('prefers URL pane, then stored, then overview', () => {
    writeStoredReportView('p1', 'slides');
    expect(initialReportView('p1', 'outputs')).toBe('outputs');
    expect(initialReportView('p1', null)).toBe('slides');
    expect(initialReportView('p2', null)).toBe('overview');
  });
});
