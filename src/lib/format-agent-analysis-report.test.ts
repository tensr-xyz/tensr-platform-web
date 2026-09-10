import { formatAnalysisReportForAgentChat } from './format-agent-analysis-report';
import { formatProvenanceConventionMarkdown } from './provenance-inspector';
import type { AnalysisReport } from './analysis-report-types';

const sampleReport = (): AnalysisReport => ({
  meta: {
    analysis_key: 'ttest_independent',
    title: 'Independent-Samples T Test',
    subtitle: 'score by group',
    generated_at: '2026-01-01T00:00:00.000Z',
    rows_dataset: 10,
  },
  summary: 'Groups differ.',
  metrics: [{ label: 'p-value', value: '0.01' }],
  tables: [],
  trust: { warnings: [], notes: [] },
});

describe('formatAnalysisReportForAgentChat provenance', () => {
  it('appends Provenance / Convention when provenance is present', () => {
    const md = formatAnalysisReportForAgentChat(sampleReport(), {
      provenance: {
        row_uid_bitset: 'BQ==',
        row_uid_bitset_miss_count: 0,
        content_fingerprint: 'abcdefghijklmnopqr',
        convention: {
          variance_mode: 'q_kish_ess',
          test_type: 't',
          overlap_mode: 'exclude',
          bessel_means: true,
          bessel_proportions: false,
          extra_deff: 1,
        },
      },
    });
    expect(md).toContain('### Provenance / Convention');
    expect(md).toContain('q_kish_ess');
    expect(md).toContain('complete');
  });

  it('omits the section when provenance is missing', () => {
    const md = formatAnalysisReportForAgentChat(sampleReport());
    expect(md).not.toContain('Provenance / Convention');
    expect(formatProvenanceConventionMarkdown(undefined)).toBeNull();
  });
});

describe('formatAnalysisReportForAgentChat coefficient tables', () => {
  it('renders every regression coefficient row and never truncates', () => {
    const rows = Array.from({ length: 12 }, (_, i) => [
      `term_${i + 1}`,
      String(0.1 * (i + 1)),
      '0.01',
    ]);
    const md = formatAnalysisReportForAgentChat({
      ...sampleReport(),
      meta: {
        ...sampleReport().meta,
        analysis_key: 'logistic_regression',
        title: 'Logistic Regression',
        subtitle: 'Full_retention',
      },
      tables: [
        {
          id: 'regression_coef',
          title: 'Coefficients',
          columns: ['Term', 'OR', 'p'],
          rows,
        },
      ],
    });
    expect(md).toContain('term_1');
    expect(md).toContain('term_12');
    expect(md).not.toMatch(/Showing \d+ of \d+ rows/i);
  });
});
