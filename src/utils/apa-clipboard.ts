import type { AnalysisReportTable } from '@/lib/analysis-report-types';

/** Rich HTML table for Word/Docs — APA horizontal rules only. */
export function tableToApaHtml(table: AnalysisReportTable): string {
  const title = table.apa_title || table.title;
  const notes = table.notes?.length
    ? `<p style="font-size:11pt;font-style:italic;margin:8px 0 0 0;">${table.notes.join(' ')}</p>`
    : '';
  const head = table.columns
    .map(
      (c, i) =>
        `<th style="border:none;border-bottom:1.5pt solid #000;padding:4px 8px;text-align:${
          i === 0 ? 'left' : 'center'
        };font-weight:bold;">${escapeHtml(c)}</th>`
    )
    .join('');
  const bodyRows = table.rows
    .map(
      (row, ri) =>
        `<tr>${row
          .map(
            (cell, ci) =>
              `<td style="border:none;${
                ri === 0 ? 'border-top:1.5pt solid #000;' : ''
              }padding:4px 8px;text-align:${ci === 0 ? 'left' : 'right'};">${escapeHtml(cell)}</td>`
          )
          .join('')}</tr>`
    )
    .join('');
  return `<div><p style="font-size:12pt;font-style:italic;margin:0 0 8px 0;">${escapeHtml(title)}</p><table style="border-collapse:collapse;border:none;font-size:11pt;font-family:Times New Roman,serif;"><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody><tfoot><tr><td colspan="${table.columns.length}" style="border:none;border-top:1.5pt solid #000;height:0;padding:0;"></td></tr></tfoot></table>${notes}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function copyTableRich(
  table: AnalysisReportTable,
  plainTsv: string
): Promise<boolean> {
  const html = tableToApaHtml(table);
  try {
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainTsv], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    await navigator.clipboard.writeText(plainTsv);
    return true;
  } catch {
    return false;
  }
}
