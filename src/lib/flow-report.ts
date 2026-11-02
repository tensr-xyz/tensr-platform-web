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
  tested: boolean;
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
    tested: significanceTested(book),
  };
}

function significanceTested(book: Record<string, unknown>): boolean {
  const display = String(book.significance_display || '');
  if (display === 'none') return false;
  const tests = book.tests as { items?: unknown[] } | undefined;
  return Boolean(tests?.items?.length) || Boolean((book.letters as unknown[] | undefined)?.length);
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

type Gap = {
  row: NumberedRow;
  host: BannerColumn;
  source: BannerColumn;
  high: number;
  low: number;
};

function shown(percent: number): string {
  return `${percent.toFixed(1).replace(/\.0$/, '')}%`;
}

function columnForLetter(table: ReportTable, letter: string): BannerColumn | undefined {
  return table.columns.find(
    column => String(column.letter_slot || '').toUpperCase() === letter.toUpperCase()
  );
}

function candidateRows(table: ReportTable, rowCut: RowCut[] | null): NumberedRow[] {
  const values = valueRows(table);
  if (!rowCut) return values;
  const wanted = new Set(rowCut.filter(item => item.tableId === table.id).map(item => item.number));
  const picked = values.filter(item => wanted.has(item.number));
  return picked.length ? picked : values;
}

/** Significant gaps on the visible columns, largest first. A letter names the lower column. */
function significantGaps(table: ReportTable, rows: NumberedRow[], columns: BannerColumn[]): Gap[] {
  const gaps: Gap[] = [];
  const shownIds = new Set(columns.map(column => column.id));
  for (const item of rows) {
    for (const host of columns) {
      const letters = lettersFor(table.letters, item.row.id, host.id);
      const high = cellPercent(item.row, host.id);
      if (!letters || high == null) continue;
      for (const letter of letters) {
        const source = columnForLetter(table, letter);
        if (!source || source.id === host.id) continue;
        const low = cellPercent(item.row, source.id);
        if (low == null || (!shownIds.has(source.id) && columns.length > 1)) continue;
        gaps.push({ row: item, host, source, high, low });
      }
    }
  }
  return gaps.sort((left, right) => right.high - right.low - (left.high - left.low));
}

function netRow(table: ReportTable): NumberedRow | null {
  const index = table.rows.findIndex(
    row => row.kind === 'net' && /top/i.test(String(row.label || ''))
  );
  return index >= 0 ? { row: table.rows[index], number: 0 } : null;
}

function leadRow(rows: NumberedRow[], columns: BannerColumn[]): NumberedRow | null {
  const score = (item: NumberedRow) =>
    Math.max(-1, ...columns.map(column => cellPercent(item.row, column.id) ?? -1));
  return [...rows].sort((left, right) => score(right) - score(left))[0] || null;
}

/** The most notable result in plain English: a significant gap, then Top 2, then the largest answer. */
export function notableFinding(
  table: ReportTable,
  segmentId: string | null,
  rowCut: RowCut[] | null
): { headline: string; support: string; lead: NumberedRow | null; significant: boolean } {
  const columns = visibleColumns(table, segmentId);
  const rows = candidateRows(table, rowCut);
  const gaps = significantGaps(table, rows, columns);
  if (gaps.length) {
    const gap = gaps[0];
    const label = gap.row.row.label || 'this answer';
    const points = Math.round((gap.high - gap.low) * 10) / 10;
    const others = gaps.length - 1;
    return {
      headline: `${bannerHeading(gap.host)} is higher than ${bannerHeading(gap.source)} on ${label}: ${shown(gap.high)} against ${shown(gap.low)}.`,
      support:
        `That ${points}-point gap is significant at 95%.` +
        (others
          ? ` ${others} other significant difference${others === 1 ? '' : 's'} in this table.`
          : ''),
      lead: gap.row,
      significant: true,
    };
  }
  const net = rowCut ? null : netRow(table);
  const lead = net || leadRow(rows, columns);
  if (!lead) return { headline: table.label, support: '', lead: null, significant: false };
  const label = lead.row.label || 'This answer';
  const figures = columns
    .map(column => ({ column, percent: cellPercent(lead.row, column.id) }))
    .filter((item): item is { column: BannerColumn; percent: number } => item.percent != null);
  if (figures.length > 1) {
    const sorted = [...figures].sort((left, right) => right.percent - left.percent);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    return {
      headline: `${label} is highest in ${bannerHeading(top.column)} at ${shown(top.percent)} and lowest in ${bannerHeading(bottom.column)} at ${shown(bottom.percent)}.`,
      support: table.tested ? 'None of the differences between columns is significant at 95%.' : '',
      lead,
      significant: false,
    };
  }
  const only = figures[0];
  const where = segmentId && only ? ` in ${bannerHeading(only.column)}` : '';
  return {
    headline: only
      ? net
        ? `${label} is ${shown(only.percent)}${where}.`
        : `${label} is the largest answer${where}, at ${shown(only.percent)}.`
      : table.label,
    support: '',
    lead,
    significant: false,
  };
}

export function findingBars(
  table: ReportTable,
  lead: NumberedRow | null,
  segmentId: string | null,
  rowCut: RowCut[] | null
): FindingBar[] {
  const columns = visibleColumns(table, segmentId);
  if (!lead || !columns.length) return [];
  if (columns.length > 1) {
    return columns.flatMap(column => {
      const percent = cellPercent(lead.row, column.id);
      return percent == null ? [] : [{ label: bannerHeading(column), percent }];
    });
  }
  const bannerId = columns[0].id;
  return candidateRows(table, rowCut)
    .flatMap(item => {
      const percent = cellPercent(item.row, bannerId);
      return percent == null ? [] : [{ label: item.row.label || '', percent }];
    })
    .sort((left, right) => right.percent - left.percent)
    .slice(0, 5);
}

export function findingFromTable(
  table: ReportTable,
  segmentId: string | null,
  rowCut: RowCut[] | null
): ReportFinding {
  const columns = visibleColumns(table, segmentId);
  const copy = notableFinding(table, segmentId, rowCut);
  return {
    id: table.id,
    tableId: table.id,
    eyebrow: `${String(table.index).padStart(2, '0')} · ${table.label}`,
    headline: copy.headline,
    support: copy.support,
    citation: `T${table.index}`,
    significant: copy.significant,
    lowBase: Boolean(
      copy.lead && columns.some(column => cellFor(copy.lead!.row, column.id)?.low_base)
    ),
    bars: findingBars(table, copy.lead, segmentId, rowCut),
  };
}
