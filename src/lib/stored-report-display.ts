import type {
  AnalysisReport,
  AnalysisReportBlock,
  AnalysisReportMetric,
  AnalysisReportTable,
} from '@/lib/analysis-report-types';
import { formatDecimalText, withoutEngineCopies } from '@/components/flow/result-tables';

const GENERIC_TITLE = /^(frequency tables?|frequencies)$/i;

function questionFrom(table: AnalysisReportTable): string {
  const match = /^Frequency Table:\s*(.+)$/i.exec(table.title || '');
  return match ? match[1].trim() : '';
}

function frequencyTotal(table: AnalysisReportTable): number | null {
  const frequency = table.columns.findIndex(column => /^frequency$/i.test(column.trim()));
  if (frequency < 0) return null;
  const total = table.rows.find(row => /^total$/i.test(String(row[0] || '').trim()));
  if (!total) return null;
  const count = Number(String(total[frequency] || '').replace(/,/g, ''));
  return Number.isFinite(count) ? count : null;
}

function withPercents(table: AnalysisReportTable, places: number): AnalysisReportTable {
  const rows = table.rows.map(row =>
    row.map((cell, index) =>
      index === 0 ? cell : formatDecimalText(String(cell ?? ''), places, table.columns[index] || '')
    )
  );
  return { ...table, rows };
}

function columnToken(summary: string, question: string): string {
  const token = (summary || '').match(/\bfor\s+([A-Za-z_][\w]*)\b/)?.[1] || '';
  if (!token) return '';
  // The summary already contains the question, so the first word is not a column id.
  if (question && summary.includes(question)) return '';
  return token;
}

function prose(text: string, variable: string, label: string): string {
  let next = text || '';
  if (variable && label && variable !== label) {
    const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const named = /[.!?]$/.test(label) ? label : `${label}.`;
    next = next.replace(new RegExp(`\\b${escaped}\\b\\.?`, 'g'), match =>
      match.endsWith('.') ? named : label
    );
  }
  next = next.replace(/\bweight:\s*none\b/gi, 'Weight: Unweighted');
  next = next.replace(/\bunweighted\b/g, 'Unweighted');
  next = next.replace(
    /([.!?])\s+([a-z])/g,
    (_all, mark: string, letter: string) => `${mark} ${letter.toUpperCase()}`
  );
  return next
    .replace(/\?\./g, '?')
    .replace(/!\./g, '!')
    .replace(/\.{2,}/g, '.');
}

function weightMetric(metric: AnalysisReportMetric): AnalysisReportMetric {
  if (!/weight/i.test(metric.label)) return metric;
  const value = metric.value.trim();
  if (!value || /^(none|unweighted)$/i.test(value)) return { ...metric, value: 'Unweighted' };
  if (/^active none; weight_column none$/i.test(value)) return { ...metric, value: 'Unweighted' };
  return metric;
}

function patchTable(table: AnalysisReportTable, places: number): AnalysisReportTable {
  const next = withPercents(table, places);
  const own = questionFrom(next);
  if (own) return { ...next, title: own };
  return next;
}

/** A stored run uses the current decimal setting, one title, and one analysis base. */
export function presentStoredReport(report: AnalysisReport, decimalPlaces: number): AnalysisReport {
  const places = Number.isFinite(decimalPlaces) ? Math.max(0, Math.min(6, decimalPlaces)) : 1;
  const tables = withoutEngineCopies(report.tables || []).filter(
    table => !/assignments \(quote spans\)/i.test(table.title || '')
  );
  const questions = [
    ...tables.map(questionFrom),
    ...(report.blocks || []).map(block =>
      block.type === 'table' ? questionFrom(block.table) : ''
    ),
  ].filter((question, index, all) => question && all.indexOf(question) === index);
  const question = questions.length === 1 ? questions[0] : '';
  const generic = GENERIC_TITLE.test(report.meta?.title || '');
  const title = question && generic ? question : report.meta.title;
  const base = tables.map(frequencyTotal).find(value => value != null) ?? null;
  const variable = columnToken(report.summary || '', question);
  const summary = prose(report.summary || '', variable, question);
  const interpretation = report.interpretation
    ? prose(report.interpretation, variable, question)
    : report.interpretation;
  const metrics = (report.metrics || []).map(weightMetric);
  const shownTables = tables.map(table => patchTable(table, places));
  const blocks = report.blocks?.map((block): AnalysisReportBlock => {
    if (block.type === 'table') return { ...block, table: patchTable(block.table, places) };
    if (block.type === 'interpretation')
      return { ...block, content: prose(block.content, variable, question) };
    if (block.type === 'metrics') return { ...block, metrics: block.metrics.map(weightMetric) };
    return block;
  });
  const inputs = report.analysis_spec?.inputs;
  const named = Array.isArray(inputs?.columns) ? inputs.columns.map(item => String(item)) : [];
  const approach = report.approach;
  const plan =
    named.length === 1 && question && named[0] && named[0] !== question && approach?.plan
      ? approach.plan.replace(
          new RegExp(`\\b${named[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
          question
        )
      : approach?.plan;
  const exclusion = report.exclusion_summary
    ? report.exclusion_summary
    : base != null && (report.meta?.analysis_key === 'frequencies' || Boolean(question))
      ? {
          rows_total: report.meta.rows_dataset,
          rows_used: base,
          rows_excluded: Math.max(0, report.meta.rows_dataset - base),
        }
      : report.exclusion_summary;
  return {
    ...report,
    meta: { ...report.meta, title },
    summary,
    interpretation,
    metrics,
    tables: shownTables,
    blocks,
    approach: approach && plan !== approach.plan ? { ...approach, plan } : approach,
    exclusion_summary: exclusion,
    answer: question && GENERIC_TITLE.test(report.answer || '') ? question : report.answer,
  };
}
