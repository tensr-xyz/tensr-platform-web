import type { CellProvenance } from './click-through';

export type BannerBookCell = {
  banner_id?: string;
  stub_row_id?: string;
  percent?: number | null;
  row_percent?: number | null;
  total_percent?: number | null;
  count?: number | null;
  mean?: number | null;
  sd?: number | null;
  unweighted_n?: number | null;
  weighted_n?: number | null;
  kish_ess?: number | null;
  low_base?: boolean;
  low_base_suppressed?: boolean;
  kind?: string;
  provenance?: CellProvenance;
};

export type BannerBook = {
  banner_columns?: Array<{ id: string; label?: string; letter_slot?: string; span?: string }>;
  rows?: Array<{ id?: string; label?: string; kind?: string; cells?: BannerBookCell[] }>;
  letters?: Array<{
    stub_row_id?: string;
    banner_id?: string;
    letter?: string;
    letter_display?: string;
  }>;
  row_uid_order?: string[];
  weight_vector?: { identity?: string; method?: string; explicit_null?: boolean };
  provenance?: CellProvenance & {
    weight_vector?: { identity?: string; explicit_null?: boolean };
  };
  spec?: { decimals?: Record<string, number>; statistics?: string[] };
};

export type DisplayCell = {
  columnPercent: string;
  rowPercent: string;
  totalPercent: string;
  countText: string;
  letters: string;
  bases: string;
  lowBase: boolean;
  kind?: string;
  unweighted_n?: number | null;
  provenance?: CellProvenance;
  stubRowId?: string;
  bannerId?: string;
};

export type DisplayRow = {
  id?: string;
  label: string;
  kind?: string;
  cells: DisplayCell[];
};

export type DisplayTable = {
  headers: Array<{ id: string; label: string; letterSlot: string }>;
  rows: DisplayRow[];
};

function fmtPct(value: number | null | undefined, places = 1): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(places)}%`;
}

function places(book: BannerBook, key: string, fallback: number): number {
  const value = book.spec?.decimals?.[key];
  return typeof value === 'number' ? value : fallback;
}

function fmtNum(value: number | null | undefined, places?: number): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  if (typeof places === 'number') return Number(value).toFixed(places);
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

function fmtMean(cell: BannerBookCell): string | null {
  if (cell.mean == null || Number.isNaN(Number(cell.mean))) return null;
  const mean = Number(cell.mean).toFixed(2);
  if (cell.sd == null || Number.isNaN(Number(cell.sd))) return mean;
  return `${mean} (SD ${Number(cell.sd).toFixed(2)})`;
}

export function displayBannerTable(book: BannerBook): DisplayTable {
  const headers = (book.banner_columns || []).map(col => ({
    id: col.id,
    label: col.label || col.id,
    letterSlot: col.letter_slot || '',
  }));
  const letterMap = new Map<string, string>();
  for (const item of book.letters || []) {
    const key = `${item.stub_row_id}::${item.banner_id}`;
    const next = item.letter_display || item.letter || '';
    if (!next) continue;
    const prev = letterMap.get(key) || '';
    letterMap.set(key, prev.includes(next) ? prev : `${prev}${next}`);
  }
  const rows: DisplayRow[] = (book.rows || []).map(row => ({
    id: row.id,
    label: row.label || row.id || '',
    kind: row.kind,
    cells: (row.cells || []).map(cell => {
      const suppressed = Boolean(cell.low_base_suppressed);
      const lowBase = Boolean(cell.low_base || cell.low_base_suppressed);
      const columnValue =
        fmtMean(cell) ?? fmtPct(cell.percent, places(book, 'column_proportion', 1));
      const rowValue = fmtPct(cell.row_percent, places(book, 'row_proportion', 1));
      const totalValue = fmtPct(cell.total_percent, places(book, 'total_proportion', 1));
      const countValue = fmtNum(cell.count ?? cell.weighted_n, places(book, 'count', 0));
      const caution = (text: string) => (lowBase && text && text !== '—' ? `${text} *` : text);
      return {
        columnPercent: suppressed ? '*' : caution(columnValue),
        rowPercent: suppressed ? '*' : caution(rowValue),
        totalPercent: suppressed ? '*' : caution(totalValue),
        countText: suppressed ? '*' : caution(countValue),
        letters: letterMap.get(`${cell.stub_row_id}::${cell.banner_id}`) || '',
        bases: `n=${fmtNum(cell.unweighted_n)} · wn=${fmtNum(cell.weighted_n)} · ESS=${fmtNum(cell.kish_ess)}`,
        lowBase,
        kind: cell.kind || row.kind,
        unweighted_n: cell.unweighted_n,
        provenance: cell.provenance,
        stubRowId: cell.stub_row_id || row.id,
        bannerId: cell.banner_id,
      };
    }),
  }));
  return { headers, rows };
}
