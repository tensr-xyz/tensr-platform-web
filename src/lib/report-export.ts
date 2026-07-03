import type { AnalysisReport, AnalysisReportTable } from '@/lib/analysis-report-types';

function escCsv(cell: string): string {
  const s = String(cell);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function tableToCsvBlock(t: AnalysisReportTable): string {
  const lines = [t.columns.map(escCsv).join(','), ...t.rows.map(row => row.map(escCsv).join(','))];
  return [`## ${t.title}`, lines.join('\n')].join('\n');
}

export function reportTablesToCsv(report: AnalysisReport): string {
  const tables = [...(report.spss_blocks ?? []), ...report.tables];
  if (!tables.length) return '';
  return tables.map(tableToCsvBlock).join('\n\n');
}

export function reportToMarkdown(report: AnalysisReport): string {
  const lines: string[] = [
    `# ${report.meta.title}`,
    '',
    report.meta.subtitle ? `_${report.meta.subtitle}_` : '',
    '',
    `Generated: ${new Date(report.meta.generated_at).toLocaleString()}`,
    '',
  ];

  if (report.summary) {
    lines.push('## Summary', '', report.summary, '');
  }

  if (report.metrics.length) {
    lines.push('## Key metrics', '');
    for (const m of report.metrics) {
      lines.push(`- **${m.label}:** ${m.value}${m.hint ? ` (${m.hint})` : ''}`);
    }
    lines.push('');
  }

  const charts = report.charts?.length ? report.charts : report.chart ? [report.chart] : [];
  if (charts.length) {
    lines.push('## Charts', '');
    for (const ch of charts) {
      if (ch) lines.push(`- ${ch.title || 'Chart'}`);
    }
    lines.push('');
  }

  const tables = [...(report.spss_blocks ?? []), ...report.tables];
  for (const t of tables) {
    lines.push(`## ${t.title}`, '');
    lines.push(`| ${t.columns.join(' | ')} |`);
    lines.push(`| ${t.columns.map(() => '---').join(' | ')} |`);
    for (const row of t.rows) {
      lines.push(`| ${row.join(' | ')} |`);
    }
    if (t.interpretation && !report.summary?.includes(t.interpretation)) {
      lines.push('', t.interpretation, '');
    }
    lines.push('');
  }

  if (report.trust.notes.length) {
    lines.push('## Notes', '');
    for (const n of report.trust.notes) lines.push(`- ${n}`);
    lines.push('');
  }

  if (report.trust.warnings.length) {
    lines.push('## Warnings', '');
    for (const w of report.trust.warnings) lines.push(`- ${w}`);
    lines.push('');
  }

  return lines.filter(line => line !== undefined).join('\n');
}

export function downloadTextFile(
  content: string,
  filename: string,
  mime = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
