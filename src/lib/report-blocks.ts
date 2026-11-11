import type {
  AnalysisReport,
  AnalysisReportBlock,
  AnalysisReportChart,
  AnalysisReportTable,
} from '@/lib/analysis-report-types';

function isSyntaxDump(table: AnalysisReportTable | undefined): boolean {
  if (!table) return false;
  return table.id === 'equivalent_syntax' || table.title === 'Equivalent R and SPSS syntax';
}

/** Resolve ordered blocks with backward compatibility for legacy reports. */
export function resolveReportBlocks(report: AnalysisReport): AnalysisReportBlock[] {
  if (report.blocks?.length) {
    return report.blocks.filter(block => block.type !== 'table' || !isSyntaxDump(block.table));
  }
  const blocks: AnalysisReportBlock[] = [];
  if (report.summary) {
    blocks.push({ type: 'interpretation', content: report.summary });
  }
  if (report.metrics?.length) {
    blocks.push({ type: 'metrics', metrics: report.metrics });
  }
  for (const t of report.spss_blocks ?? []) {
    blocks.push({ type: 'table', table: t });
  }
  for (const t of report.tables ?? []) {
    if (!isSyntaxDump(t)) blocks.push({ type: 'table', table: t });
  }
  const charts = report.charts?.length ? report.charts : report.chart ? [report.chart] : [];
  for (const ch of charts) {
    if (ch) blocks.push({ type: 'chart', chart: ch });
  }
  return blocks;
}

export function reportCharts(report: AnalysisReport): AnalysisReportChart[] {
  return resolveReportBlocks(report)
    .filter((b): b is { type: 'chart'; chart: AnalysisReportChart } => b.type === 'chart')
    .map(b => b.chart);
}

export function reportTables(report: AnalysisReport): AnalysisReportTable[] {
  return resolveReportBlocks(report)
    .filter((b): b is { type: 'table'; table: AnalysisReportTable } => b.type === 'table')
    .map(b => b.table);
}
