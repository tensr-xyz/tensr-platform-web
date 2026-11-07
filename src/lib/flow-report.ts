import { isNonAnswerTheme } from '@/components/flow/coding-review-data';
import {
  bannerColumns,
  bannerHeading,
  lettersFor,
  type BannerCell,
  type BannerColumn,
  type BannerRow,
  type SigLetter,
} from '@/lib/flow-survey';

function missingBanner(column: BannerColumn): boolean {
  const label = String(column.label || column.column_label || column.id || '');
  return isNonAnswerTheme(label);
}

export type ReportTable = {
  id: string;
  label: string;
  index: number;
  rows: BannerRow[];
  columns: BannerColumn[];
  letters: SigLetter[];
  tested: boolean;
  key?: string;
  decimals?: number;
};

export type ValueLabels = Record<string, Record<string, string> | null | undefined>;

function bareCode(code: string): string {
  return code.replace(/\.0+$/, '');
}

/** A shown label for a code: the stored value label, else a reading of a 0/1 column, never a bare code. */
export function codeLabel(
  column: string,
  code: string,
  labels: ValueLabels,
  role: 'row' | 'banner',
  codes: string[] = []
): string {
  const key = bareCode(code);
  const stored = labels[column]?.[key] ?? labels[column]?.[code];
  if (stored) return stored;
  const binary = codes.length > 0 && codes.every(item => ['0', '1'].includes(bareCode(item)));
  if (binary) {
    if (key === '1') return column;
    if (key === '0') return role === 'row' ? `not ${column}` : `no ${column}`;
  }
  return key;
}

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

/** Replace variable names in a title with the question label, once, on the original text. */
export function titledWithQuestions(
  title: string,
  columns: { name?: string; label?: string }[]
): string {
  const usable = columns
    .map(column => ({ name: column.name || '', label: (column.label || '').trim() }))
    .filter(
      column =>
        column.name && column.label && column.label.toLowerCase() !== column.name.toLowerCase()
    )
    .sort((left, right) => right.name.length - left.name.length);
  if (!usable.length) return title;
  const labels = new Map(usable.map(column => [column.name.toLowerCase(), column.label]));
  const pattern = usable
    .map(column => column.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return title.replace(
    new RegExp(`(?<![\\w])(?:${pattern})(?![\\w])`, 'gi'),
    match => labels.get(match.toLowerCase()) || match
  );
}

export function reportTableFromBook(
  id: string,
  label: string,
  index: number,
  book: Record<string, unknown>,
  labels: ValueLabels = {}
): ReportTable {
  const stub = String(((book.stubs as { column?: string }[]) || [])[0]?.column || '');
  const rawRows = (book.rows as BannerRow[]) || [];
  const rowCodes = rawRows
    .filter(row => (row.kind || 'value') === 'value')
    .map(row => String(row.id).split(':').pop() || '');
  const rows = rawRows.map(row => {
    if ((row.kind || 'value') !== 'value' || !stub) return row;
    const code = String(row.id).split(':').pop() || '';
    const labelled = String(row.label || '') !== bareCode(code) && String(row.label || '') !== code;
    return labelled ? row : { ...row, label: codeLabel(stub, code, labels, 'row', rowCodes) };
  });
  const rawColumns = bannerColumns(book);
  const byColumn = new Map<string, string[]>();
  rawColumns.forEach(column => {
    const name = column.codes?.[0]?.column;
    const code = column.codes?.[0]?.code;
    if (name && code != null) byColumn.set(name, [...(byColumn.get(name) || []), String(code)]);
  });
  const columns = rawColumns.map(column => {
    const name = column.codes?.[0]?.column;
    const code = column.codes?.[0]?.code;
    if (!name || code == null) return column;
    const heading = bannerHeading(column);
    if (heading !== bareCode(String(code)) && heading !== String(code)) return column;
    return {
      ...column,
      label: codeLabel(name, String(code), labels, 'banner', byColumn.get(name)),
    };
  });
  const banners = [...byColumn.keys()].sort();
  const decimals = book.spec as { decimals?: Record<string, number> } | undefined;
  const places = Object.values(decimals?.decimals || {}).find(value => typeof value === 'number');
  return {
    id,
    label,
    index,
    rows,
    columns,
    letters: (book.letters as SigLetter[]) || [],
    tested: significanceTested(book),
    key: `${stub}|${banners.join(',')}`,
    ...(typeof places === 'number' ? { decimals: places } : {}),
  };
}

/** One finding per question: an identical table, or one whose banners another table covers, is dropped. */
export function distinctTables(tables: ReportTable[]): ReportTable[] {
  const parts = (table: ReportTable) => {
    const [stub, banners = ''] = String(table.key || table.id).split('|');
    return { stub, banners: banners ? banners.split(',') : [] };
  };
  return tables.filter((table, index) => {
    const mine = parts(table);
    return !tables.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      const theirs = parts(other);
      if (theirs.stub !== mine.stub) return false;
      const covers = mine.banners.every(name => theirs.banners.includes(name));
      if (!covers) return false;
      const same = theirs.banners.length === mine.banners.length;
      return same ? otherIndex < index : true;
    });
  });
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
  const compared = table.columns.filter(column => column.id !== 'total' && !missingBanner(column));
  return compared.length ? compared : table.columns.filter(column => !missingBanner(column));
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

function shown(percent: number, places = 1): string {
  const text = percent.toFixed(places);
  return `${places > 0 ? text.replace(/\.0+$/, '') : text}%`;
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
  const negative = (gap: Gap) => (/^not /i.test(String(gap.row.row.label || '')) ? 1 : 0);
  return gaps.sort(
    (left, right) =>
      right.high - right.low - (left.high - left.low) || negative(left) - negative(right)
  );
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
  const places = table.decimals ?? 1;
  const format = (percent: number) => shown(percent, places);
  const gaps = significantGaps(table, rows, columns);
  if (gaps.length) {
    const gap = gaps[0];
    const label = gap.row.row.label || 'this answer';
    const points = Math.round((gap.high - gap.low) * 10) / 10;
    const others = gaps.filter(
      item => item !== gap && !/^not /i.test(String(item.row.row.label || ''))
    ).length;
    return {
      headline: `${label}: ${format(gap.high)} among ${bannerHeading(gap.host)} vs ${format(gap.low)} among ${bannerHeading(gap.source)}.`,
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
      headline: `${label} is highest in ${bannerHeading(top.column)} at ${format(top.percent)} and lowest in ${bannerHeading(bottom.column)} at ${format(bottom.percent)}.`,
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
        ? `${label} is ${format(only.percent)}${where}.`
        : `${label} is the largest answer${where}, at ${format(only.percent)}.`
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

/** A finding from the project overview, before any table grid has loaded. */
export function findingFromOverview(row: {
  id: string;
  title: string;
  number?: number | null;
}): ReportFinding {
  const number = typeof row.number === 'number' && row.number > 0 ? row.number : 0;
  const citation = number ? `T${number}` : '';
  return {
    id: row.id,
    tableId: row.id,
    eyebrow: citation && row.title ? `${citation} · ${row.title}` : row.title || citation,
    headline: row.title,
    support: '',
    citation,
    significant: false,
    lowBase: false,
    bars: [],
  };
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
    eyebrow: table.index > 0 ? `T${table.index} · ${table.label}` : table.label,
    headline: copy.headline,
    support: copy.support,
    citation: table.index > 0 ? `T${table.index}` : '',
    significant: copy.significant,
    lowBase: Boolean(
      copy.lead && columns.some(column => cellFor(copy.lead!.row, column.id)?.low_base)
    ),
    bars: findingBars(table, copy.lead, segmentId, rowCut),
  };
}
