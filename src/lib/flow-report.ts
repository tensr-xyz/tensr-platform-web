import {
  bannerColumns,
  bannerHeading,
  lettersFor,
  type BannerCell,
  type BannerColumn,
  type BannerRow,
  type SigLetter,
} from '@/lib/flow-survey';

export type ReportTable = {
  id: string;
  label: string;
  index: number;
  rows: BannerRow[];
  columns: BannerColumn[];
  letters: SigLetter[];
};

export type RowCut = { tableId: string; number: number };

export type FindingBar = { label: string; percent: number };

export type ReportFinding = {
  id: string;
  tableId: string;
  eyebrow: string;
  headline: string;
  support: string;
  citation: string;
  significant: boolean;
  lowBase: boolean;
  bars: FindingBar[];
};

type NumberedRow = { row: BannerRow; number: number };

export function reportTableFromBook(
  id: string,
  label: string,
  index: number,
  book: Record<string, unknown>
): ReportTable {
  return {
    id,
    label,
    index,
    rows: (book.rows as BannerRow[]) || [],
    columns: bannerColumns(book),
    letters: (book.letters as SigLetter[]) || [],
  };
}

function isValueRow(row: BannerRow): boolean {
  return row.kind !== 'net' && row.kind !== 'base' && row.kind !== 'sd' && Boolean(row.label);
}

export function valueRows(table: ReportTable): NumberedRow[] {
  return table.rows.filter(isValueRow).map((row, index) => ({ row, number: index + 1 }));
}

export function segmentChoices(tables: ReportTable[]): BannerColumn[] {
  const seen = new Map<string, BannerColumn>();
  tables.forEach(table => {
    table.columns.forEach(column => {
      if (column.id && column.id !== 'total' && !seen.has(column.id)) seen.set(column.id, column);
    });
  });
  return [...seen.values()];
}

function visibleColumns(table: ReportTable, segmentId: string | null): BannerColumn[] {
  if (segmentId) {
    const match = table.columns.filter(column => column.id === segmentId);
    if (match.length) return match;
  }
  const compared = table.columns.filter(column => column.id !== 'total');
  return compared.length ? compared : table.columns;
}

function cellFor(row: BannerRow, bannerId: string): BannerCell | undefined {
  return (row.cells || []).find(cell => cell.banner_id === bannerId);
}

function cellPercent(row: BannerRow, bannerId: string): number | null {
  const value = cellFor(row, bannerId)?.percent;
  return typeof value === 'number' ? value : null;
}

export function citedRows(
  table: ReportTable,
  segmentId: string | null,
  rowCut: RowCut[] | null
): NumberedRow[] {
  const values = valueRows(table);
  if (rowCut) {
    const wanted = new Set(
      rowCut.filter(item => item.tableId === table.id).map(item => item.number)
    );
    const picked = values.filter(item => wanted.has(item.number));
    if (picked.length) return picked;
  }
  const columns = visibleColumns(table, segmentId);
  const lettered = values.filter(item =>
    columns.some(column => lettersFor(table.letters, item.row.id, column.id))
  );
  if (lettered.length) return lettered.slice(0, 4);
  return [...values]
    .sort((left, right) => {
      const score = (item: NumberedRow) =>
        Math.max(-1, ...columns.map(column => cellPercent(item.row, column.id) ?? -1));
      return score(right) - score(left);
    })
    .slice(0, 4);
}

export function citationLabel(index: number, numbers: number[]): string {
  const noun = numbers.length === 1 ? 'row' : 'rows';
  return `T${index} · ${noun} ${numbers.join(', ')}`;
}

export function findingBars(
  table: ReportTable,
  cited: NumberedRow[],
  segmentId: string | null
): FindingBar[] {
  const columns = visibleColumns(table, segmentId);
  if (!cited.length || !columns.length) return [];
  if (columns.length > 1) {
    const lead = cited[0];
    return columns.flatMap(column => {
      const percent = cellPercent(lead.row, column.id);
      return percent == null ? [] : [{ label: bannerHeading(column), percent }];
    });
  }
  const bannerId = columns[0].id;
  return cited.flatMap(item => {
    const percent = cellPercent(item.row, bannerId);
    return percent == null ? [] : [{ label: item.row.label || `Row ${item.number}`, percent }];
  });
}

function cellLine(row: BannerRow, column: BannerColumn, number: number): string {
  const cell = cellFor(row, column.id);
  if (!cell || typeof cell.percent !== 'number') return '';
  const count = cell.unweighted_n != null ? `n ${cell.unweighted_n}` : 'n —';
  const base = cell.column_unweighted_n != null ? ` of ${cell.column_unweighted_n}` : '';
  return `${row.label} is ${cell.percent.toFixed(1)}% in ${bannerHeading(column)} (${count}${base}, row ${number})`;
}

export function analysisReportForTable(
  table: ReportTable,
  segmentId: string | null,
  rowCut: RowCut[] | null
): Record<string, unknown> {
  const columns = visibleColumns(table, segmentId);
  const cited = citedRows(table, segmentId, rowCut);
  const lines = cited.flatMap(item =>
    columns.map(column => cellLine(item.row, column, item.number)).filter(Boolean)
  );
  const warnings = cited.flatMap(item =>
    columns
      .filter(column => cellFor(item.row, column.id)?.low_base)
      .map(column => `${item.row.label} in ${bannerHeading(column)} is a low base.`)
  );
  return {
    meta: { analysis_key: 'banner_table', title: table.label },
    summary: lines.join('. ') + (lines.length ? '.' : ''),
    metrics: lines.map(line => ({ label: table.label, value: line })),
    tables: [
      {
        title: table.label,
        rows: cited.map(item => ({
          row: item.number,
          label: item.row.label,
          cells: columns.map(column => {
            const cell = cellFor(item.row, column.id);
            return {
              column: bannerHeading(column),
              percent: cell?.percent ?? null,
              n: cell?.unweighted_n ?? null,
              base: cell?.column_unweighted_n ?? null,
              letter: lettersFor(table.letters, item.row.id, column.id),
              low_base: Boolean(cell?.low_base),
            };
          }),
        })),
      },
    ],
    trust: {
      notes: ['Column letters use a 95% test when the table requested them.'],
      warnings,
    },
  };
}

function section(markdown: string, heading: string): string {
  const match = markdown.match(new RegExp(`## ${heading}\\s*([\\s\\S]*?)(?=\\n## |$)`, 'i'));
  return match?.[1]?.trim() || '';
}

function plain(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findingCopy(
  markdown: string,
  fallback: string
): { headline: string; support: string } {
  const summary = plain(section(markdown, 'Executive Summary'));
  const usable = summary && !/see results below/i.test(summary) ? summary : fallback;
  const sentences = usable
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
  const headline = sentences[0] || fallback;
  if (sentences[1]) return { headline, support: sentences[1] };
  const results = plain(section(markdown, 'Results and Findings'));
  const support = results
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence && sentence !== headline)
    .slice(0, 2)
    .join(' ');
  return { headline, support };
}

export function findingFromTable(
  table: ReportTable,
  markdown: string,
  segmentId: string | null,
  rowCut: RowCut[] | null
): ReportFinding {
  const columns = visibleColumns(table, segmentId);
  const cited = citedRows(table, segmentId, rowCut);
  const numbers = cited.map(item => item.number).sort((left, right) => left - right);
  const report = analysisReportForTable(table, segmentId, rowCut);
  const copy = findingCopy(markdown, String(report.summary || table.label));
  return {
    id: table.id,
    tableId: table.id,
    eyebrow: `${String(table.index).padStart(2, '0')} · ${table.label}`,
    headline: copy.headline,
    support: copy.support,
    citation: citationLabel(table.index, numbers),
    significant: cited.some(item =>
      columns.some(column => lettersFor(table.letters, item.row.id, column.id))
    ),
    lowBase: cited.some(item => columns.some(column => cellFor(item.row, column.id)?.low_base)),
    bars: findingBars(table, cited, segmentId),
  };
}
