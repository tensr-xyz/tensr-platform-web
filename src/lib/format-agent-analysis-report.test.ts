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

  it('renders predicted-probability tables alongside coefficients', () => {
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
          id: 'logit_coef',
          title: 'Logistic regression coefficients',
          columns: ['Term', 'Estimate'],
          rows: [['Intercept', '0.37']],
        },
        {
          id: 'logit_predict',
          title: 'Predicted probabilities (others at mean)',
          columns: ['At', 'Probability', 'Percent'],
          rows: [
            ['cohs_routine=1', '0.42', '42'],
            ['cohs_routine=5', '0.61', '61'],
          ],
        },
      ],
    });
    expect(md).toContain('Predicted probabilities (others at mean)');
    expect(md).toContain('cohs_routine=1');
    expect(md).toContain('cohs_routine=5');
  });

  it('omits equivalent R/SPSS syntax tables from chat', () => {
    const md = formatAnalysisReportForAgentChat({
      ...sampleReport(),
      meta: {
        ...sampleReport().meta,
        analysis_key: 'anova_twoway',
        title: 'Two-Way ANOVA',
        subtitle: 'Time_90 by Interval × Pay',
      },
      tables: [
        {
          id: 'anova2',
          title: 'Type II ANOVA',
          columns: ['Source', 'F', 'p-value'],
          rows: [['Interval', '2.4', '.105']],
        },
        {
          id: 'equivalent_syntax',
          title: 'Equivalent R and SPSS syntax',
          columns: ['System', 'Syntax'],
          rows: [['R', "df <- read.csv('dataset.csv')\n# anova_twoway"]],
        },
      ],
    });
    expect(md).toContain('Type II ANOVA');
    expect(md).not.toContain('Equivalent R and SPSS syntax');
    expect(md).not.toContain('# anova_twoway');
  });
});
