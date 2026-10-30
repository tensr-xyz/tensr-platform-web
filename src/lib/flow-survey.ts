export type BannerColumn = {
  id: string;
  label?: string;
  codes?: { column?: string; code?: string }[];
};

export type BannerCell = {
  banner_id: string;
  percent?: number | null;
  column_unweighted_n?: number;
  unweighted_n?: number;
  provenance?: { row_uid_bitset?: string };
};

export type BannerRow = {
  id: string;
  label?: string;
  column?: string;
  source_text_column?: string | null;
  kind?: string;
  cells?: BannerCell[];
};

export type SigLetter = { stub_row_id?: string; banner_id?: string; letter?: string };

export type SurveyCell = {
  bitset: string;
  textColumn: string;
  claim: string;
  base: string;
  weight: string;
  percent: string;
  n: string;
};

export function bannerHeading(column: BannerColumn): string {
  const code = column.codes?.[0]?.code;
  if (code != null && String(code).trim()) return String(code);
  const label = column.label || column.id;
  const split = label.indexOf('=');
  return split >= 0 ? label.slice(split + 1) : label;
}

export function lettersFor(letters: SigLetter[], rowId: string, bannerId: string): string {
  return letters
    .filter(item => item.stub_row_id === rowId && item.banner_id === bannerId && item.letter)
    .map(item => item.letter)
    .join('');
}

export function codedStub(column: string): {
  column: string;
  multiple_response?: boolean;
  value_delimiter?: string;
} {
  if (!column.endsWith('_codes')) return { column };
  return { column, multiple_response: true, value_delimiter: '|' };
}

export function efficiencyPercent(value: unknown): string {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '';
  const percent = number <= 1 ? number * 100 : number;
  return `${percent.toFixed(1)}%`;
}

export function selectionFromCell(
  book: Record<string, unknown>,
  row: BannerRow,
  cell: BannerCell | undefined
): SurveyCell | null {
  const bitset = cell?.provenance?.row_uid_bitset;
  if (!cell || !bitset) return null;
  const weight = book.resolved_weight || (book.weight as { column?: string } | undefined)?.column;
  const percent = cell.percent != null ? `${cell.percent.toFixed(1)}%` : '';
  const count = cell.unweighted_n != null ? String(cell.unweighted_n) : '';
  return {
    bitset,
    textColumn: row.source_text_column || row.column || '',
    claim: [row.label, percent, count ? `n ${count}` : ''].filter(Boolean).join(' · '),
    base: cell.column_unweighted_n != null ? String(cell.column_unweighted_n) : '',
    weight: weight ? String(weight) : '',
    percent,
    n: count,
  };
}

export function bannerColumns(book: Record<string, unknown>): BannerColumn[] {
  const stored = (book.banner_columns as BannerColumn[]) || [];
  if (stored.length) return stored;
  return Array.from(
    new Map(
      ((book.rows as BannerRow[]) || [])
        .flatMap(row => row.cells || [])
        .map(cell => [cell.banner_id, { id: cell.banner_id, label: cell.banner_id }])
    ).values()
  );
}
