export type BannerColumn = {
  id: string;
  label?: string;
  column_label?: string;
  letter_slot?: string;
  codes?: { column?: string; code?: string }[];
};

export type BannerCell = {
  banner_id: string;
  percent?: number | null;
  row_percent?: number | null;
  total_percent?: number | null;
  count?: number | null;
  mean?: number | null;
  low_base?: boolean;
  column_unweighted_n?: number;
  column_weighted_n?: number;
  unweighted_n?: number;
  provenance?: {
    row_uid_bitset?: string;
    origin_bitsets?: Record<string, { row_uid_bitset?: string }>;
    provenance_unavailable?: string;
  };
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
  letter: string;
};

export function bannerHeading(column: BannerColumn): string {
  const label = column.label || column.id;
  if (label && label !== column.id) {
    const split = label.indexOf('=');
    return split >= 0 ? label.slice(split + 1) : label;
  }
  const code = column.codes?.[0]?.code;
  if (code != null && String(code).trim()) return String(code);
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

function bitsetFrom(cell: BannerCell): string {
  if (cell.provenance?.provenance_unavailable) return '';
  const direct = cell.provenance?.row_uid_bitset;
  if (direct) return direct;
  const origins = cell.provenance?.origin_bitsets;
  if (!origins) return '';
  for (const item of Object.values(origins)) {
    if (item?.row_uid_bitset) return item.row_uid_bitset;
  }
  return '';
}

export function selectionFromCell(
  book: Record<string, unknown>,
  row: BannerRow,
  cell: BannerCell | undefined,
  letter = ''
): SurveyCell | null {
  if (!cell) return null;
  const bitset = bitsetFrom(cell);
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
    letter,
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

function percentText(value: number): string {
  return `${value.toFixed(0)}%`;
}

/** One sentence from a themes grid: the largest theme, then the largest significant segment gap. */
export function themeRead(book: Record<string, unknown>): {
  text: string;
  rowId: string;
  bannerId: string;
} {
  const rows = ((book.rows as BannerRow[]) || []).filter(
    row => (row.kind || 'value') === 'value' && row.label
  );
  const columns = bannerColumns(book);
  const letters = (book.letters as SigLetter[]) || [];
  const total = (row: BannerRow) =>
    (row.cells || []).find(cell => cell.banner_id === 'total')?.percent ?? null;
  const largest = [...rows].sort((a, b) => (total(b) ?? -1) - (total(a) ?? -1))[0];
  if (!largest || total(largest) == null) return { text: '', rowId: '', bannerId: '' };
  let text = `${largest.label} is the largest theme, at ${percentText(total(largest) as number)} overall.`;
  let pick = { rowId: largest.id, bannerId: 'total' };
  let best = -1;
  for (const letter of letters) {
    const row = rows.find(item => item.id === letter.stub_row_id);
    const host = columns.find(column => column.id === letter.banner_id);
    if (!row || !host || !letter.letter) continue;
    const high = (row.cells || []).find(cell => cell.banner_id === host.id)?.percent;
    for (const slot of letter.letter) {
      const source = columns.find(
        column =>
          String((column as { letter_slot?: string }).letter_slot || '').toUpperCase() ===
          slot.toUpperCase()
      );
      const low = source
        ? (row.cells || []).find(cell => cell.banner_id === source.id)?.percent
        : null;
      if (typeof high !== 'number' || typeof low !== 'number' || !source) continue;
      if (high - low > best) {
        best = high - low;
        text = `${largest.label} is the largest theme, at ${percentText(total(largest) as number)} overall. ${row.label} is higher in ${bannerHeading(host)} (${percentText(high)}) than ${bannerHeading(source)} (${percentText(low)}) at 95%.`;
        pick = { rowId: row.id, bannerId: host.id };
      }
    }
  }
  if (best < 0 && columns.some(column => column.id !== 'total')) {
    text += ' No segment differs significantly.';
  }
  return { text, ...pick };
}

/** The one line under a banner: base, weight, filter, effective base, and the test. */
export function bannerFootnote(book: Record<string, unknown>): string {
  const parts: string[] = [];
  if (book.answered_n != null) {
    parts.push(
      book.respondent_n != null
        ? `Base: answered ${book.answered_n} of ${book.respondent_n}`
        : `Base: ${book.answered_n}`
    );
  }
  const weight = book.weight as
    | { label?: string; column?: string; weight_aware?: boolean }
    | undefined;
  if (weight?.weight_aware) parts.push(`Weight: ${weight.label || weight.column || 'on'}`);
  const filter = book.filter_ref as
    | { filters?: { column?: string; value?: unknown }[] }
    | undefined;
  const named = (filter?.filters || [])
    .map(item => [item.column, item.value].filter(part => part != null && part !== '').join(' = '))
    .filter(Boolean);
  if (named.length) parts.push(`Filter: ${named.join(', ')}`);
  const ess = bannerColumns(book)
    .map(column => (column as { kish_effective_base?: number }).kish_effective_base)
    .find(value => typeof value === 'number');
  if (typeof ess === 'number') parts.push(`Effective base: ${Math.round(ess)}`);
  const letters = book.letters as unknown[] | undefined;
  if (String(book.significance_display || '') !== 'none' && letters?.length) {
    parts.push('Column proportions test at 95%');
  }
  return parts.join(' · ');
}

/** The same cells the table shows, as one series per row. */
export function chartSeriesFromBook(
  book: Record<string, unknown> | null
): { label: string; values: { name: string; value: number }[] }[] {
  if (!book) return [];
  const rows = ((book.rows as BannerRow[]) || []).filter(
    row => row.label && row.kind !== 'net' && row.kind !== 'base' && row.kind !== 'mean'
  );
  const hosts = bannerColumns(book).filter(column => column.id !== 'total');
  const columns = hosts.length ? hosts : bannerColumns(book);
  return rows
    .map(row => ({
      label: String(row.label),
      values: columns.map(column => {
        const found = (row.cells || []).find(item => item.banner_id === column.id);
        const raw =
          typeof found?.percent === 'number' ? found.percent : Number(found?.unweighted_n ?? 0);
        return { name: column.label || column.id, value: Number.isFinite(raw) ? raw : 0 };
      }),
    }))
    .filter(row => row.values.some(item => item.value));
}
