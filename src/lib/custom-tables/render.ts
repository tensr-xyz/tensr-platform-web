import type { CellProvenance } from './click-through';

export type BannerBookCell = {
  banner_id?: string;
  stub_row_id?: string;
  percent?: number | null;
  row_percent?: number | null;
  unweighted_n?: number | null;
  weighted_n?: number | null;
  kish_ess?: number | null;
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
};

export type DisplayCell = {
  columnPercent: string;
  rowPercent: string;
  letters: string;
  bases: string;
  lowBase: boolean;
  kind?: string;
  unweighted_n?: number | null;
  provenance?: CellProvenance;
};

export type DisplayRow = {
  label: string;
  kind?: string;
  cells: DisplayCell[];
};

export type DisplayTable = {
  headers: Array<{ id: string; label: string; letterSlot: string }>;
  rows: DisplayRow[];
};

function fmtPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(1)}%`;
}

function fmtNum(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
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
    letterMap.set(key, item.letter_display || item.letter || '');
  }
  const rows: DisplayRow[] = (book.rows || []).map(row => ({
    label: row.label || row.id || '',
    kind: row.kind,
    cells: (row.cells || []).map(cell => {
      const lowBase = Boolean(cell.low_base_suppressed);
      return {
        columnPercent: lowBase ? '*' : fmtPct(cell.percent),
        rowPercent: lowBase ? '*' : fmtPct(cell.row_percent),
        letters: letterMap.get(`${cell.stub_row_id}::${cell.banner_id}`) || '',
        bases: `n=${fmtNum(cell.unweighted_n)} · wn=${fmtNum(cell.weighted_n)} · ESS=${fmtNum(cell.kish_ess)}`,
        lowBase,
        kind: cell.kind || row.kind,
        unweighted_n: cell.unweighted_n,
        provenance: cell.provenance,
      };
    }),
  }));
  return { headers, rows };
}
