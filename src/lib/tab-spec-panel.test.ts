import {
  tabSpecBuildLabel,
  tabSpecFileLine,
  tabSpecIsMatched,
  tabSpecPreviewRows,
  tabSpecReviewLabel,
  tabSpecStatusLabel,
  tabSpecSummaryLine,
  type TabSpecReport,
} from './tab-spec-panel';

const report: TabSpecReport = {
  filename: 'W4 tab plan.xlsx',
  n_tables: 42,
  n_banners: 3,
  n_matched: 40,
  n_needs_you: 2,
  file_line: '42 tables · 3 banners',
  summary_line: '40 matched · 2 need you · stat tests, bases and nets taken from the spec',
  tables: [
    {
      index: 1,
      title: 'Awareness (prompted)',
      banner_label: 'Demographics',
      status: 'matched',
      status_label: 'Matched',
    },
    {
      index: 3,
      title: '"Q22 recode 1-3 = Low"',
      banner_label: 'Demographics',
      status: 'needs_question',
      status_label: 'Pick question',
      refusal: { reason: 'The stub text does not match one question in this file.' },
    },
  ],
};

describe('tab spec panel helpers', () => {
  it('keeps Paper 10h file and summary lines', () => {
    expect(tabSpecFileLine(report)).toBe('42 tables · 3 banners');
    expect(tabSpecSummaryLine(report)).toContain('40 matched');
    expect(tabSpecBuildLabel(40)).toBe('Build 40 tables');
    expect(tabSpecReviewLabel(2)).toBe('Review 2');
  });

  it('labels matched and pick-question rows', () => {
    expect(tabSpecStatusLabel(report.tables![0])).toBe('Matched');
    expect(tabSpecStatusLabel(report.tables![1])).toBe('Pick question');
    expect(tabSpecIsMatched(report.tables![0])).toBe(true);
    expect(tabSpecIsMatched(report.tables![1])).toBe(false);
  });

  it('filters preview rows for review', () => {
    const review = tabSpecPreviewRows(report, { reviewOnly: true });
    expect(review).toHaveLength(1);
    expect(review[0].status).toBe('needs_question');
  });
});
