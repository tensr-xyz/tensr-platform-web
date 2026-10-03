import type { AnalysisReportChart } from '@/lib/analysis-report-types';
import { errorBarFootnote, errorBarFootnoteLines } from './chart-error-bars';

function bar(errorKind?: 'se' | 'ci', errors?: number[]): AnalysisReportChart {
  return {
    kind: 'bar',
    title: 'Mean score by age band',
    x_label: 'age_band',
    y_label: 'Mean score',
    categories: ['18-34', '35-54'],
    series: [{ name: 'score', values: [5, 6], errors, error_kind: errorKind }],
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
});
