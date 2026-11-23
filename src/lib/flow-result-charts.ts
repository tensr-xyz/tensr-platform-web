import type { AnalysisReportChart } from '@/lib/analysis-report-types';

const POSITIVE = new Set(['yes', 'y', 'true', '1', 'aware', 'selected', 'mentioned', 'ticked']);
const NEGATIVE = new Set([
  'no',
  'n',
  'false',
  '0',
  'not aware',
  'unaware',
  'not selected',
  'not mentioned',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function parsePercent(cell: unknown): number | null {
  if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
  const text = String(cell ?? '')
    .trim()
    .replace(/,/g, '');
  if (!text || text === '—' || text === '-') return null;
  const bare = text.endsWith('%') ? text.slice(0, -1).trim() : text;
  const value = Number(bare);
  return Number.isFinite(value) ? value : null;
}

function questionLabel(title: unknown): string {
  const text = String(title || '').trim();
  const prefix = 'Frequency Table: ';
  return text.startsWith(prefix)
    ? text.slice(prefix.length).trim() || 'Question'
    : text || 'Question';
}

function isFrequencySummaryRow(label: string): boolean {
  const folded = label.trim().toLowerCase();
  return (
    folded === 'total' ||
    folded === 'total respondents' ||
    folded === 'missing' ||
    folded === 'base'
  );
}

function categoryShares(table: Record<string, unknown>): Array<{ label: string; percent: number }> {
  const headers = Array.isArray(table.columns) ? table.columns.map(String) : [];
  let validAt = headers.findIndex(
    header => /valid/i.test(header) && (/%|percent/i.test(header) || header.trim() === 'Valid %')
  );
  if (validAt < 0) {
    validAt = headers.findIndex(
      header => /respondent/i.test(header) && (/%|percent/i.test(header) || header.includes('%'))
    );
  }
  const rows = Array.isArray(table.rows) ? table.rows : [];
  const shares: Array<{ label: string; percent: number }> = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const label = String(row[0] ?? '').trim();
    if (!label || isFrequencySummaryRow(label)) continue;
    const percent = validAt >= 0 ? parsePercent(row[validAt]) : parsePercent(row[3] ?? row[2]);
    if (percent == null) continue;
    shares.push({ label, percent });
  }
  return shares;
}

function positiveShare(shares: Array<{ label: string; percent: number }>): number | null {
  if (shares.length !== 2) return null;
  const byFold = new Map(shares.map(item => [item.label.toLowerCase(), item.percent]));
  let positive: number | undefined;
  let negative: number | undefined;
  for (const [label, percent] of byFold) {
    if (POSITIVE.has(label)) positive = percent;
    if (NEGATIVE.has(label)) negative = percent;
  }
  return positive != null && negative != null ? positive : null;
}

/** Build a bar chart from frequency tables when the report did not attach one. */
export function chartFromFrequencyTables(
  tables: unknown,
  weighting: 'weighted' | 'unweighted' | 'none' = 'none'
): AnalysisReportChart | null {
  if (!Array.isArray(tables) || !tables.length) return null;
  const blocks = tables.filter((table): table is Record<string, unknown> =>
    Boolean(table && typeof table === 'object')
  );
  if (!blocks.length) return null;

  if (blocks.length >= 2) {
    const multi: Array<{ label: string; percent: number }> = [];
    for (const block of blocks) {
      const shares = categoryShares(block);
      const yes = positiveShare(shares);
      if (yes == null) {
        multi.length = 0;
        break;
      }
      multi.push({ label: questionLabel(block.title), percent: yes });
    }
    if (multi.length >= 2) {
      return {
        kind: 'bar_grouped',
        title: 'Percent yes',
        x_label: 'Question',
        y_label: 'Valid percent',
        categories: multi.map(item => item.label),
        series: [{ name: 'Yes', values: multi.map(item => item.percent) }],
        weighting,
      };
    }
  }

  const shares = categoryShares(blocks[0]);
  if (!shares.length) return null;
  const question = questionLabel(blocks[0].title);
  const multi =
    Boolean(blocks[0].multiple_response) || blocks[0].mr_base === 'percent_of_respondents';
  const seriesName = multi ? 'Percent of respondents' : 'Valid percent';
  return {
    kind: 'bar_grouped',
    title: question,
    x_label: question,
    y_label: seriesName,
    categories: shares.map(item => item.label),
    series: [{ name: seriesName, values: shares.map(item => item.percent) }],
    weighting,
  };
}

function pushChart(charts: AnalysisReportChart[], chart: unknown) {
  if (!chart || typeof chart !== 'object') return;
  const kind = String((chart as { kind?: unknown }).kind || '');
  if (!kind) return;
  charts.push(chart as AnalysisReportChart);
}

function chartsFromEnvelope(envelope: Record<string, unknown> | null): AnalysisReportChart[] {
  if (!envelope) return [];
  const charts: AnalysisReportChart[] = [];
  pushChart(charts, envelope.chart);
  const report = asRecord(envelope.report);
  if (report) {
    pushChart(charts, report.chart);
    if (Array.isArray(report.charts)) {
      for (const chart of report.charts) pushChart(charts, chart);
    }
  }
  const nested = asRecord(envelope.result);
  if (nested) {
    pushChart(charts, nested.chart);
    const nestedReport = asRecord(nested.report);
    if (nestedReport) {
      pushChart(charts, nestedReport.chart);
      if (Array.isArray(nestedReport.charts)) {
        for (const chart of nestedReport.charts) pushChart(charts, chart);
      }
    }
    if (!charts.length) {
      const frequencyTables =
        (Array.isArray(nested.frequency_tables) && nested.frequency_tables) ||
        (Array.isArray(envelope.frequency_tables) && envelope.frequency_tables) ||
        null;
      const weight = asRecord(nested.weight) || asRecord(envelope.weight);
      const stats = asRecord(nested.statistics_block);
      const weighting =
        weight?.column || weight?.weight_aware || (stats && 'Weighted base' in stats)
          ? 'weighted'
          : 'none';
      const derived = chartFromFrequencyTables(frequencyTables, weighting);
      if (derived) charts.push(derived);
    }
  }
  return charts;
}

/** Strip a leading "Weighted " so the same axes are not shown twice. */
function chartTitleKey(title: unknown): string {
  const text = String(title || '').trim();
  return text.replace(/^Weighted\s+/i, '');
}

/** Charts attached to tool results / stored runs for Flow cards. */
export function chartsFromToolPayloads(results: unknown): AnalysisReportChart[] {
  const list = Array.isArray(results) ? results : results ? [results] : [];
  const charts: AnalysisReportChart[] = [];
  const seen = new Map<string, number>();
  for (const item of list) {
    const record = asRecord(item);
    if (!record) continue;
    const nested = asRecord(record.result);
    for (const chart of [...chartsFromEnvelope(record), ...chartsFromEnvelope(nested)]) {
      const key = JSON.stringify({
        kind: chart.kind,
        title: 'title' in chart ? chartTitleKey(chart.title) : '',
        categories: 'categories' in chart ? chart.categories : undefined,
      });
      const prior = seen.get(key);
      if (prior !== undefined) {
        const oldTitle = 'title' in charts[prior] ? String(charts[prior].title || '') : '';
        const newTitle = 'title' in chart ? String(chart.title || '') : '';
        if (/^Weighted\s+/i.test(newTitle) && !/^Weighted\s+/i.test(oldTitle)) {
          charts[prior] = chart;
        }
        continue;
      }
      seen.set(key, charts.length);
      charts.push(chart);
    }
  }
  return charts;
}
