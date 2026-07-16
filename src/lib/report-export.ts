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

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chartToHtmlSnippet(chart: NonNullable<AnalysisReport['chart']>): string {
  const title = escHtml(chart.title || 'Chart');
  if (chart.kind === 'histogram' && chart.bins?.length) {
    const max = Math.max(...chart.bins.map(b => b.count), 1);
    const bars = chart.bins
      .map(b => {
        const h = Math.max(4, Math.round((b.count / max) * 120));
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:24px">
          <div style="height:${h}px;width:100%;background:#2563eb;border-radius:3px 3px 0 0" title="${b.count}"></div>
          <span style="font-size:10px;color:#64748b">${escHtml(String(b.start))}</span>
        </div>`;
      })
      .join('');
    return `<figure style="margin:1.25rem 0"><figcaption style="font-weight:600;margin-bottom:0.5rem">${title}</figcaption>
      <div style="display:flex;align-items:flex-end;gap:4px;height:140px;border-bottom:1px solid #e2e8f0;padding:0 4px">${bars}</div>
      <p style="font-size:12px;color:#64748b;margin-top:0.35rem">${escHtml(chart.x_label)}</p></figure>`;
  }
  if (chart.kind === 'bar_grouped' && chart.categories?.length) {
    const series = chart.series?.[0];
    const values = series?.values ?? [];
    const max = Math.max(...values.map(v => Math.abs(Number(v) || 0)), 1);
    const bars = chart.categories
      .map((cat, i) => {
        const v = Number(values[i] ?? 0);
        const h = Math.max(4, Math.round((Math.abs(v) / max) * 120));
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:28px">
          <div style="height:${h}px;width:100%;background:#2563eb;border-radius:3px 3px 0 0" title="${escHtml(String(v))}"></div>
          <span style="font-size:10px;color:#64748b;text-align:center;max-width:64px;overflow:hidden;text-overflow:ellipsis">${escHtml(cat)}</span>
        </div>`;
      })
      .join('');
    return `<figure style="margin:1.25rem 0"><figcaption style="font-weight:600;margin-bottom:0.5rem">${title}</figcaption>
      <div style="display:flex;align-items:flex-end;gap:6px;height:140px;border-bottom:1px solid #e2e8f0;padding:0 4px">${bars}</div>
      <p style="font-size:12px;color:#64748b;margin-top:0.35rem">${escHtml(chart.x_label)} → ${escHtml(chart.y_label)}</p></figure>`;
  }
  return `<figure style="margin:1.25rem 0"><figcaption style="font-weight:600">${title}</figcaption>
    <p style="color:#64748b;font-size:13px">Chart available in the Tensr app (export PNG/SVG from the report view).</p></figure>`;
}

/** Self-contained HTML report with answer-first narrative, tables, and inline chart sketches. */
export function reportToHtml(report: AnalysisReport): string {
  const charts = report.charts?.length ? report.charts : report.chart ? [report.chart] : [];
  const tables = [...(report.spss_blocks ?? []), ...report.tables];
  const generated = new Date(report.meta.generated_at).toLocaleString();

  const metricLis = report.metrics
    .map(
      m =>
        `<li><strong>${escHtml(m.label)}:</strong> ${escHtml(m.value)}${m.hint ? ` <span style="color:#64748b">(${escHtml(m.hint)})</span>` : ''}</li>`
    )
    .join('\n');

  const tableHtml = tables
    .map(t => {
      const head = t.columns.map(c => `<th>${escHtml(c)}</th>`).join('');
      const body = t.rows
        .map(row => `<tr>${row.map(c => `<td>${escHtml(String(c ?? ''))}</td>`).join('')}</tr>`)
        .join('\n');
      return `<section style="margin:1.75rem 0">
        <h2 style="font-size:1.1rem;margin:0 0 0.75rem">${escHtml(t.title)}</h2>
        <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
        ${t.interpretation ? `<p style="margin-top:0.75rem;color:#334155">${escHtml(t.interpretation)}</p>` : ''}
      </section>`;
    })
    .join('\n');

  const methodBits: string[] = [];
  methodBits.push(
    `Analysis: <strong>${escHtml(report.meta.analysis_key)}</strong>${
      report.meta.spss_procedure ? ` (${escHtml(report.meta.spss_procedure)})` : ''
    }.`
  );
  if (report.exclusion_summary && report.exclusion_summary.rows_excluded > 0) {
    methodBits.push(
      `Used ${report.exclusion_summary.rows_used.toLocaleString()} of ${report.exclusion_summary.rows_total.toLocaleString()} rows (${report.exclusion_summary.rows_excluded.toLocaleString()} excluded for missing data).`
    );
  }
  for (const n of report.trust?.notes ?? []) methodBits.push(escHtml(n));
  for (const w of report.trust?.warnings ?? []) methodBits.push(`Warning: ${escHtml(w)}`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(report.meta.title)}</title>
<style>
  body { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; color: #0f172a; max-width: 820px; margin: 2rem auto; padding: 0 1.25rem 3rem; line-height: 1.55; }
  h1 { font-size: 1.75rem; margin: 0 0 0.35rem; }
  .sub { color: #64748b; margin: 0 0 1.25rem; }
  .answer { background: #f8fafc; border-left: 4px solid #2563eb; padding: 0.9rem 1rem; margin: 1.25rem 0; }
  table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
  th, td { border: 1px solid #e2e8f0; padding: 0.4rem 0.55rem; text-align: left; }
  th { background: #f1f5f9; }
  .meta { font-size: 0.85rem; color: #64748b; }
  .methods { background: #fffbeb; border: 1px solid #fde68a; padding: 0.9rem 1rem; margin-top: 2rem; }
</style>
</head>
<body>
  <p class="meta">Generated by Tensr · ${escHtml(generated)}</p>
  <h1>${escHtml(report.meta.title)}</h1>
  ${report.meta.subtitle ? `<p class="sub">${escHtml(report.meta.subtitle)}</p>` : ''}
  ${
    report.summary
      ? `<div class="answer"><strong>Answer</strong><p style="margin:0.4rem 0 0">${escHtml(report.summary)}</p></div>`
      : ''
  }
  ${metricLis ? `<h2>Key results</h2><ul>${metricLis}</ul>` : ''}
  ${charts.map(c => (c ? chartToHtmlSnippet(c) : '')).join('\n')}
  ${tableHtml}
  <section class="methods">
    <h2 style="margin-top:0;font-size:1.1rem">Methodology</h2>
    <ul>${methodBits.map(b => `<li>${b}</li>`).join('')}</ul>
  </section>
</body>
</html>`;
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
