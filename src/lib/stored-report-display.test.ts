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
});
