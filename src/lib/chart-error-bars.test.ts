import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { chartFootnoteLines, errorBarFootnote, errorBarFootnoteLines } from './chart-error-bars';

function bar(
  errorKind?: 'se' | 'ci',
  errors?: number[],
  extras?: { significance_note?: string; letters?: string[] }
): AnalysisReportChart {
  return {
    kind: 'bar',
    title: 'Mean score by age band',
    x_label: 'age_band',
    y_label: 'Mean score',
    categories: ['18-34', '35-54'],
    series: [
      {
        name: 'score',
        values: [5, 6],
        errors,
        error_kind: errorKind,
        ...(extras?.letters ? { letters: extras.letters } : {}),
      },
    ],
    ...(extras?.significance_note ? { significance_note: extras.significance_note } : {}),
  } as AnalysisReportChart;
}

describe('error bar footnote', () => {
  it('names the CI as approximate, normal, and Kish effective n', () => {
    expect(errorBarFootnoteLines(bar('ci', [0.4, 0.5]))[0]).toBe(
      'Error bars: approximate 95% CI (normal, Kish effective n).'
    );
    expect(errorBarFootnote(bar('ci', [0.4, 0.5]))).toContain('Taylor');
  });

  it('labels standard-error bars and stays silent without bars', () => {
    expect(errorBarFootnoteLines(bar('se', [0.2, 0.3]))[0]).toBe(
      'Error bars: ±1 standard error (Kish effective n).'
    );
    expect(errorBarFootnoteLines(bar())).toEqual([]);
    expect(errorBarFootnoteLines(bar('ci', [0, 0]))).toEqual([]);
  });

  it('appends the column-letter test after error-bar lines', () => {
    expect(
      chartFootnoteLines(
        bar('ci', [0.4, 0.5], { significance_note: 'Column proportions test at 95%' })
      )
    ).toEqual([
      'Error bars: approximate 95% CI (normal, Kish effective n).',
      'Not the Taylor standard errors used in weighted tables.',
      'Column proportions test at 95%',
    ]);
    expect(
      chartFootnoteLines(
        bar(undefined, undefined, { significance_note: 'Paired McNemar test at 95%' })
      )
    ).toEqual(['Paired McNemar test at 95%']);
  });
});
