import {
  initialReportView,
  readStoredReportView,
  REPORT_OVERVIEW_BOOT,
  reportViewFromPaneParam,
  reportViewHref,
  reportViewStorageKey,
  writeStoredReportView,
} from '@/components/flow/report-view';

describe('REPORT_OVERVIEW_BOOT', () => {
  it('paints Overview chrome before findings resolve', () => {
    expect(REPORT_OVERVIEW_BOOT.phase).toBe('ready');
    expect(REPORT_OVERVIEW_BOOT.findingsPhase).toBe('loading');
  });
});

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

  it('builds deep links for Slides and Outputs with an optional run', () => {
    expect(reportViewHref('/flow/p/1', 'slides')).toBe('/flow/p/1/report?pane=slides');
    expect(reportViewHref('/flow/p/1', 'outputs')).toBe('/flow/p/1/report?pane=outputs');
    expect(reportViewHref('/flow/p/1', 'outputs', 'run-9')).toBe(
      '/flow/p/1/report?pane=outputs&run=run-9'
    );
    expect(reportViewHref('/flow/p/1', 'overview', 'run-9')).toBe('/flow/p/1/report?pane=overview');
  });
});
