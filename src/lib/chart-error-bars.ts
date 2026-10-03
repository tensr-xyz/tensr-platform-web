import type { AnalysisReportChart } from '@/lib/analysis-report-types';

const TAYLOR_CAVEAT = 'Not the Taylor standard errors used in weighted tables.';

export function errorBarFootnoteLines(chart: AnalysisReportChart): string[] {
  if (!('series' in chart) || !Array.isArray(chart.series)) return [];
  let kind: 'se' | 'ci' | null = null;
  for (const series of chart.series) {
    if (!('errors' in series) || !series.errors?.some(value => Number(value) > 0)) continue;
    kind = series.error_kind === 'se' ? 'se' : 'ci';
    if (kind === 'ci') break;
  }
  if (kind === 'ci') {
    return ['Error bars: approximate 95% CI (normal, Kish effective n).', TAYLOR_CAVEAT];
  }
  if (kind === 'se') {
    return ['Error bars: ±1 standard error (Kish effective n).', TAYLOR_CAVEAT];
  }
  return [];
}

export function errorBarFootnote(chart: AnalysisReportChart): string | null {
  const lines = errorBarFootnoteLines(chart);
  return lines.length ? lines.join(' ') : null;
}
