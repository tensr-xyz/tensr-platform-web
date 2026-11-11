import type { AnalysisReport } from '@/lib/analysis-report-types';

import { presentStoredReport } from './stored-report-display';

function frequencyReport(): AnalysisReport {
  return {
    meta: {
      analysis_key: 'frequencies',
      title: 'Frequency table',
      subtitle: '',
      generated_at: '2026-11-06T00:00:00Z',
      rows_dataset: 800,
    },
    summary: 'Frequency table for sat_brewco. unweighted.',
    answer: 'Frequency table',
    metrics: [{ label: 'Weight', value: 'none' }],
    tables: [
      {
        id: 'freq',
        title: 'Frequency Table: How satisfied are you with Brew & Co?',
        columns: ['', 'Frequency', 'Percent (incl. missing)', 'Valid Percent'],
        rows: [
          ['Satisfied', '57', '7.125', '11.4'],
          ['Total', '500', '100.000', ''],
        ],
      },
    ],
    trust: { notes: [], warnings: [] },
  };
}

describe('stored frequency reports', () => {
  it('uses the question, one base, the decimal setting, and Unweighted', () => {
    const shown = presentStoredReport(frequencyReport(), 1);
    expect(shown.meta.title).toBe('How satisfied are you with Brew & Co?');
    expect(shown.answer).toBe('How satisfied are you with Brew & Co?');
    expect(shown.exclusion_summary?.rows_used).toBe(500);
    expect(shown.summary).toBe(
      'Frequency table for How satisfied are you with Brew & Co? Unweighted.'
    );
    expect(shown.summary).not.toMatch(/sat_brewco/);
    expect(shown.metrics[0].value).toBe('Unweighted');
    expect(shown.tables[0].rows[0][2]).toBe('7.1');
    expect(shown.tables[0].title).toBe('How satisfied are you with Brew & Co?');
  });

  it('does not repeat a question that contains the variable, or rewrite the word none', () => {
    const report = frequencyReport();
    report.summary = 'Frequency table for age. None of these stayed.';
    report.tables[0].title = 'Frequency Table: What is your age?';
    const shown = presentStoredReport(report, 1);
    expect(shown.summary).toBe('Frequency table for What is your age? None of these stayed.');
  });

  it('does not rewrite a question that is already in the summary', () => {
    const report = frequencyReport();
    report.meta.title = 'How satisfied are you with Brew & Co overall?';
    report.summary = 'Frequency table for How satisfied are you with Brew & Co overall?';
    report.tables[0].title = 'Frequency Table: How satisfied are you with Brew & Co overall?';
    report.exclusion_summary = { rows_total: 249, rows_used: 249, rows_excluded: 0 };
    const shown = presentStoredReport(report, 1);
    expect(shown.summary).toBe('Frequency table for How satisfied are you with Brew & Co overall?');
    report.summary = 'Frequency table for How satisfied are you with Brew & Co overall?.';
    report.analysis_spec = { analysis_key: 'frequencies', inputs: { columns: ['sat_brewco'] } };
    report.approach = { plan: 'Running frequencies on sat_brewco as requested.' };
    const cleaned = presentStoredReport(report, 1);
    expect(cleaned.summary).toBe(
      'Frequency table for How satisfied are you with Brew & Co overall?'
    );
    expect(cleaned.approach?.plan).toBe(
      'Running frequencies on How satisfied are you with Brew & Co overall? as requested.'
    );
    expect(shown.exclusion_summary?.rows_excluded).toBe(0);
    expect(shown.tables[0].rows[0][2]).toBe('7.1');
  });
});

describe('stored analysis reports', () => {
  it('keeps the builder table and drops the engine copy', () => {
    const report = frequencyReport();
    report.meta.analysis_key = 'correlation';
    report.meta.title = 'Bivariate Correlations';
    report.tables = [
      {
        id: 'correlation',
        title: 'Pearson correlation matrix',
        columns: ['', 'Price paid'],
        rows: [['Price paid', '1.000']],
      },
      {
        id: 'correlations',
        title: 'Correlations',
        columns: ['Variable', 'Price paid'],
        rows: [['Price paid', '1.000']],
      },
    ];
    const shown = presentStoredReport(report, 3);
    expect(shown.tables.map(table => table.title)).toEqual(['Correlations']);
  });
});
