import type { AnalysisReport, AnalysisReportTable } from '@/lib/analysis-report-types';

function formatMarkdownTable(table: AnalysisReportTable, maxRows = 8): string {
  if (!table.columns.length) return '';
  const rows = table.rows.slice(0, maxRows);
  const header = `| ${table.columns.join(' | ')} |`;
  const sep = `| ${table.columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${r.map(c => String(c ?? '')).join(' | ')} |`).join('\n');
  const more =
    table.rows.length > maxRows ? `\n\n*Showing ${maxRows} of ${table.rows.length} rows.*` : '';
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

function pickHighlightTable(report: AnalysisReport): AnalysisReportTable | undefined {
  const priority = [
    'anova_groups',
    'ttest_groups',
    'regression_coef',
    'correlation',
    'descriptives',
  ];
  for (const id of priority) {
    const t = report.tables.find(tbl => tbl.id === id);
    if (t?.rows.length) return t;
  }
  return report.tables.find(t => t.rows.length > 0);
}

/** Rich markdown for agent chat — metrics, interpretation, and a compact table. */
export function formatAnalysisReportForAgentChat(report: AnalysisReport): string {
  const lines: string[] = [];

  lines.push(`### ${report.meta.title}`);
  if (report.meta.subtitle) {
    lines.push(`*${report.meta.subtitle}*`);
  }
  lines.push('');

  if (report.summary) {
    lines.push(report.summary);
    lines.push('');
  }

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

  const table = pickHighlightTable(report);
  if (table) {
    lines.push(`**${table.title}**`);
    lines.push('');
    lines.push(formatMarkdownTable(table));
    lines.push('');
  }

  if (report.exclusion_summary && report.exclusion_summary.rows_excluded > 0) {
    lines.push(
      `*Analysis used ${report.exclusion_summary.rows_used.toLocaleString()} of ${report.exclusion_summary.rows_total.toLocaleString()} rows (${report.exclusion_summary.rows_excluded.toLocaleString()} excluded due to missing data).*`
    );
  }

  return lines.join('\n').trim();
}
