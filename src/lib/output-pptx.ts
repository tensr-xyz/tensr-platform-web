/** Build a pipeline tool-trace step from a result card, then export a PowerPoint slide. */

import type { RunTable } from '@/components/flow/run-document';
import { downloadExport } from '@/components/flow/survey-screens';

function parsePercent(value: string): number | null {
  const cleaned = value.replace(/%/g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** A display table → engine rows the PowerPoint builder already knows. */
export function tableToEngineBook(table: RunTable): Record<string, unknown> | null {
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  if (!columns.length || !rows.length) return null;
  const shareIndex = columns.findIndex(
    column =>
      column.includes('%') || column.toLowerCase() === 'percent' || column.toLowerCase() === 'share'
  );
  const valueIndex = shareIndex >= 0 ? shareIndex : Math.min(1, columns.length - 1);
  const engineRows = rows
    .map((row, index) => {
      const label = String(row[0] || '').trim();
      if (!label) return null;
      const percent = parsePercent(String(row[valueIndex] ?? ''));
      const cell: Record<string, unknown> = { banner_id: 'total' };
      if (percent !== null) cell.percent = percent;
      else cell.count = 0;
      return {
        id: `r${index}`,
        label,
        kind: 'value',
        cells: [cell],
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (!engineRows.length) return null;
  return {
    title: table.title || 'Table',
    banner_columns: [{ id: 'total', label: columns[valueIndex] || 'Total' }],
    rows: engineRows,
    spec: { label: table.title || 'Table', statistics: ['column_proportion'] },
  };
}

export function toolTraceFromResult(args: {
  lead?: string;
  tables: RunTable[];
  footnote?: string;
}): Record<string, unknown>[] {
  const table = args.tables.map(tableToEngineBook).find(Boolean);
  if (!table) return [];
  if (args.footnote) {
    (table as Record<string, unknown>).base_label = args.footnote;
  }
  return [
    {
      name: 'run_analysis',
      args: {
        analysis_type: 'frequencies',
        why_this_test: String((table as { title?: string }).title || 'Finding'),
        request_body: {},
      },
      result: {
        answer_markdown:
          (args.lead || '').trim() || String((table as { title?: string }).title || 'Finding'),
        result: table,
      },
    },
  ];
}

export async function exportResultAsPptx(args: {
  runId?: string;
  lead?: string;
  tables: RunTable[];
  footnote?: string;
  projectId?: string;
  templateBase64?: string;
  templateName?: string;
}): Promise<void> {
  const body: Record<string, unknown> = {
    single_slide: true,
    project_id: args.projectId || '',
    headline: (args.lead || '').trim(),
    footnote: (args.footnote || '').trim(),
    include_footnote: true,
  };
  if (args.templateBase64) body.template_base64 = args.templateBase64;
  if (args.runId) {
    body.run_id = args.runId;
  } else {
    const trace = toolTraceFromResult({
      lead: args.lead,
      tables: args.tables,
      footnote: args.footnote,
    });
    if (!trace.length) throw new Error('This result has no table to put on a slide.');
    body.tool_trace = trace;
  }
  const stem = args.templateName ? args.templateName.replace(/\.(pptx|potx)$/i, '') : 'slide';
  await downloadExport(`/datasets/reports/pipeline/export?format=pptx`, `${stem}.pptx`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function appendResultToDeck(args: {
  datasetId: string;
  lead?: string;
  tables: RunTable[];
  footnote?: string;
  templateBase64?: string;
  templateName?: string;
}): Promise<void> {
  if (!args.datasetId) throw new Error('Open a file before adding to a deck.');
  const book = args.tables.map(tableToEngineBook).find(Boolean);
  if (!book) throw new Error('This result has no table to add.');
  const bars = (
    (book as { rows?: { label?: string; cells?: { percent?: number }[] }[] }).rows || []
  )
    .map(row => {
      const percent = row.cells?.[0]?.percent;
      if (typeof percent !== 'number' || !row.label) return null;
      return { label: row.label, percent };
    })
    .filter((row): row is { label: string; percent: number } => Boolean(row));
  const { exportOfficeDeckAndDownload } = await import('@/lib/office-deck-job');
  await exportOfficeDeckAndDownload(args.datasetId, 'slide', {
    spec_ids: [],
    outputs: [
      {
        title: String((book as { title?: string }).title || args.lead || 'Finding'),
        support: (args.footnote || args.lead || '').trim(),
        bars,
      },
    ],
    headlines: args.lead
      ? [{ title: String((book as { title?: string }).title || 'Finding'), text: args.lead }]
      : [],
    ...(args.templateBase64 ? { template_base64: args.templateBase64 } : {}),
    ...(args.templateName ? { template_name: args.templateName } : {}),
    name: 'Added from an output',
  });
}
