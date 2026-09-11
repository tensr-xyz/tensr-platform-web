import type { AnalysisReport, AnalysisReportTable } from '@/lib/analysis-report-types';
import { formatProvenanceConventionMarkdown } from '@/lib/provenance-inspector';

function isRegressionCoefficientTable(table: AnalysisReportTable): boolean {
  if (table.id === 'regression_coef' || table.id === 'logit_coef') return true;
  return /coefficient|odds ratio/i.test(table.title || '');
}

function formatMarkdownTable(table: AnalysisReportTable, maxRows = 8): string {
  if (!table.columns.length) return '';
  const limit = isRegressionCoefficientTable(table) ? table.rows.length : maxRows;
  const rows = table.rows.slice(0, limit);
  const header = `| ${table.columns.join(' | ')} |`;
  const sep = `| ${table.columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${r.map(c => String(c ?? '')).join(' | ')} |`).join('\n');
  const more =
    table.rows.length > limit ? `\n\n*Showing ${limit} of ${table.rows.length} rows.*` : '';
  return `${header}\n${sep}\n${body}${more}`;
}

function parsePValue(metrics: AnalysisReport['metrics']): number | null {
  const pMetric = metrics.find(m => /^p[- ]?value/i.test(m.label));
  if (!pMetric?.value) return null;
  const cleaned = pMetric.value.replace(/[^\d.eE+-]/g, '');
  const p = Number.parseFloat(cleaned);
  return Number.isFinite(p) ? p : null;
}

function pValueDisplay(metrics: AnalysisReport['metrics']): string | null {
  const pMetric = metrics.find(m => /^p[- ]?value/i.test(m.label));
  return pMetric?.value?.trim() || null;
}

function formatPPhrase(pDisplay: string): string {
  const trimmed = pDisplay.trim();
  if (trimmed.startsWith('<')) return `p ${trimmed}`;
  return `p = ${trimmed}`;
}

function interpretationAlreadyInSummary(report: AnalysisReport, text: string): boolean {
  const summary = report.summary?.trim();
  const content = text.trim();
  if (!content) return true;
  if (summary === content) return true;
  return Boolean(summary && summary.includes(content));
}

function buildInterpretation(report: AnalysisReport): string | null {
  const key = report.meta.analysis_key;
  const pDisplay = pValueDisplay(report.metrics);
  const p = parsePValue(report.metrics);

  if (key === 'anova_oneway') {
    const f = report.metrics.find(m => /f statistic/i.test(m.label))?.value;
    if (pDisplay != null && p != null) {
      if (p < 0.05) {
        return (
          `At least one group mean of **${report.meta.subtitle.split(' by ')[0] || 'the outcome'}** ` +
          `differs significantly across **${report.meta.subtitle.split(' by ')[1] || 'groups'}** ` +
          `(F = ${f ?? '—'}, ${formatPPhrase(pDisplay)}). ` +
          `Inspect the group means below; post-hoc tests can show which pairs differ.`
        );
      }
      return (
        `No significant overall difference among group means ` +
        `(F = ${f ?? '—'}, ${formatPPhrase(pDisplay)}). ` +
        `The groups look similar on average for this outcome.`
      );
    }
  }

  if (key === 'ttest_independent' && pDisplay != null && p != null) {
    if (p < 0.05) {
      return `The two groups differ significantly on the outcome (${formatPPhrase(pDisplay)}).`;
    }
    return `No significant difference between the two groups (${formatPPhrase(pDisplay)}).`;
  }

  if (key === 'correlation') {
    return null;
  }

  const blockInterps = (report.blocks ?? [])
    .filter((b): b is { type: 'interpretation'; content: string } => b.type === 'interpretation')
    .map(b => b.content)
    .filter(content => content && !interpretationAlreadyInSummary(report, content));
  if (blockInterps.length) {
    return blockInterps.join('\n\n');
  }

  if (report.interpretation && report.interpretation !== report.summary) {
    const extra = report.interpretation.replace(report.summary, '').trim();
    if (extra && !interpretationAlreadyInSummary(report, extra)) {
      return extra;
    }
  }

  for (const t of report.tables) {
    if (t.interpretation && !interpretationAlreadyInSummary(report, t.interpretation)) {
      return t.interpretation;
    }
  }

  return null;
}

/** Rich markdown for agent chat — answer first, then metrics/detail. */
export function formatAnalysisReportForAgentChat(
  report: AnalysisReport,
  opts?: { provenance?: Record<string, unknown> | null }
): string {
  const lines: string[] = [];

  if (report.summary) {
    lines.push(report.summary);
    lines.push('');
  }

  lines.push(`### ${report.meta.title}`);
  if (report.meta.subtitle) {
    lines.push(`*${report.meta.subtitle}*`);
  }
  lines.push('');

  if (report.metrics.length) {
    lines.push('**Key results**');
    for (const m of report.metrics.filter(
      metric => !/levene|homogeneity|shapiro/i.test(metric.label)
    )) {
      const value = m.emphasis ? `**${m.value}**` : m.value;
      lines.push(`- **${m.label}:** ${value}${m.hint ? ` — ${m.hint}` : ''}`);
    }
    lines.push('');
  }

  const interpretation = buildInterpretation(report);
  if (interpretation) {
    lines.push(interpretation);
    lines.push('');
  }

  const tablesToShow = report.tables.filter(t => t.rows.length > 0 && t.id !== 'equivalent_syntax');
  for (const table of tablesToShow) {
    lines.push(`**${table.title}**`);
    lines.push('');
    if (table.id === 'banner_table' && table.columns.length > 12) {
      lines.push(
        `*Full crosstab (${table.rows.length} rows × ${table.columns.length - 1} columns) — open the Analysis Report tab and scroll horizontally.*`
      );
      lines.push('');
    }
    lines.push(formatMarkdownTable(table, table.id === 'banner_table' ? 12 : 8));
    lines.push('');
  }

  if (report.exclusion_summary && report.exclusion_summary.rows_excluded > 0) {
    lines.push(
      `*Analysis used ${report.exclusion_summary.rows_used.toLocaleString()} of ${report.exclusion_summary.rows_total.toLocaleString()} rows (${report.exclusion_summary.rows_excluded.toLocaleString()} excluded due to missing data).*`
    );
  }

  const provenanceSection = formatProvenanceConventionMarkdown(opts?.provenance);
  if (provenanceSection) {
    lines.push('');
    lines.push(provenanceSection);
  }

  return lines.join('\n').trim();
}
