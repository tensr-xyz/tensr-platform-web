import {
  bannerColumns,
  bannerHeading,
  type BannerCell,
  type BannerColumn,
  type BannerRow,
} from '@/lib/flow-survey';

export type NumberTraceRow = {
  label: string;
  value: string;
  /** Accent colour for the value (R check match). */
  accent?: boolean;
};

export type NumberTrace = {
  value: string;
  context: string;
  rows: NumberTraceRow[];
  respondentCount: number | null;
  showRespondentsLabel: string;
};

type TraceTest = {
  stub_row_id?: string;
  left?: string;
  right?: string;
  significant?: boolean;
  p_adjusted?: number | null;
  p_value?: number | null;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function formatCount(value: number, places = 0): string {
  if (places <= 0) return Math.round(value).toLocaleString('en-GB');
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
}

function formatPercent(value: number, digits: number): string {
  const places = Math.max(0, Math.min(6, Math.trunc(digits)));
  const text = value.toFixed(places);
  return `${places > 0 ? text.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1') : text}%`;
}

/** p < 0.01 / p < 0.05 / p = 0.03 — Displayr-style thresholds, not variable names. */
export function formatTraceP(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  if (value < 0.001) return 'p < 0.001';
  if (value < 0.01) return 'p < 0.01';
  if (value < 0.05) return 'p < 0.05';
  return `p = ${value.toFixed(2)}`;
}

function columnLabel(
  name: string,
  columnLabels: { name: string; label: string }[] | undefined
): string {
  const found = (columnLabels || []).find(item => item.name === name);
  const label = found?.label?.trim();
  return label && label !== name ? label : name;
}

function weightLabel(
  book: Record<string, unknown>,
  columnLabels?: { name: string; label: string }[]
): string {
  const weight = book.weight as
    | { label?: string; column?: string; weight_aware?: boolean }
    | undefined;
  if (!weight?.weight_aware) return '';
  const named = String(weight.label || '').trim();
  if (named && !/^(none|unweighted|null)$/i.test(named) && named !== weight.column) {
    return named;
  }
  const column = String(weight.column || book.resolved_weight || '').trim();
  if (!column || /^(none|unweighted|null)$/i.test(column)) return '';
  return columnLabel(column, columnLabels);
}

function filterLabel(
  book: Record<string, unknown>,
  columnLabels?: { name: string; label: string }[]
): string {
  const filter = book.filter_ref as
    | { filters?: { column?: string; value?: unknown }[] }
    | undefined;
  const named = (filter?.filters || [])
    .map(item => {
      const column = String(item.column || '').trim();
      if (!column) return '';
      const value =
        item.value == null || item.value === ''
          ? ''
          : Array.isArray(item.value)
            ? item.value.map(String).join(', ')
            : String(item.value);
      return value
        ? `${columnLabel(column, columnLabels)} = ${value}`
        : columnLabel(column, columnLabels);
    })
    .filter(Boolean);
  return named.length ? named.join(', ') : 'None';
}

function testsFor(book: Record<string, unknown>): TraceTest[] {
  const block = book.tests;
  if (Array.isArray(block)) return block as TraceTest[];
  if (Array.isArray((block as { items?: TraceTest[] } | undefined)?.items)) {
    return (block as { items: TraceTest[] }).items;
  }
  if (Array.isArray(book.cell_comparisons)) return book.cell_comparisons as TraceTest[];
  return [];
}

function columnForLetter(columns: BannerColumn[], letter: string): BannerColumn | undefined {
  return columns.find(
    column => String(column.letter_slot || '').toUpperCase() === letter.toUpperCase()
  );
}

/** Letters on a cell name columns this cell is significantly higher than. */
export function significanceTrace(
  book: Record<string, unknown>,
  rowId: string,
  bannerId: string,
  letters: string
): string {
  if (String(book.significance_display || '') === 'none') return 'None';
  const slots = letters.trim();
  if (!slots) return 'None';
  const columns = bannerColumns(book);
  const tests = testsFor(book);
  const parts: string[] = [];
  for (const letter of slots) {
    const other = columnForLetter(columns, letter);
    if (!other || other.id === bannerId) continue;
    const test = tests.find(
      item =>
        item.stub_row_id === rowId &&
        item.significant === true &&
        ((item.left === bannerId && item.right === other.id) ||
          (item.right === bannerId && item.left === other.id))
    );
    const p = formatTraceP(test?.p_adjusted ?? test?.p_value);
    parts.push(`Higher than ${bannerHeading(other)}${p ? ` (${p})` : ''}`);
  }
  return parts.length ? parts.join('; ') : 'None';
}

function rCheckRow(book: Record<string, unknown>): NumberTraceRow | null {
  const kind = String(book.r_check || book.rCheck || '')
    .trim()
    .toLowerCase();
  const statement = String(book.r_statement || book.rStatement || '').trim();
  if (!kind && !statement) return null;
  if (kind === 'verified' || kind === 'match' || /^match/i.test(statement)) {
    return {
      label: 'R check',
      value: statement || 'Matches',
      accent: true,
    };
  }
  if (kind === 'mismatch' || /mismatch|differ/i.test(statement)) {
    return { label: 'R check', value: statement || 'Does not match' };
  }
  if (kind === 'pending') {
    return { label: 'R check', value: statement || 'Checking…' };
  }
  if (statement) return { label: 'R check', value: statement };
  return null;
}

function cellValueText(
  cell: BannerCell,
  digits: number,
  figure: 'percent' | 'count' | 'mean'
): string {
  if (figure === 'mean' && cell.mean != null && Number.isFinite(cell.mean)) {
    return Number(cell.mean).toFixed(Math.max(1, digits));
  }
  if (figure === 'count') {
    const raw = cell.count ?? cell.unweighted_n;
    const n = finiteNumber(raw);
    return n == null ? '—' : formatCount(n);
  }
  if (cell.percent != null && Number.isFinite(cell.percent)) {
    return formatPercent(cell.percent, digits);
  }
  const n = finiteNumber(cell.unweighted_n ?? cell.count);
  return n == null ? '—' : formatCount(n);
}

/**
 * Paper 9f number-trace fields from a banner cell: value, stub · banner,
 * respondents, weighted base, filter, significance, optional R check.
 */
export function numberTraceFromCell(
  book: Record<string, unknown>,
  row: BannerRow,
  column: BannerColumn,
  cell: BannerCell | undefined,
  letters = '',
  opts?: {
    digits?: number;
    figure?: 'percent' | 'count' | 'mean';
    columnLabels?: { name: string; label: string }[];
  }
): NumberTrace | null {
  if (!cell) return null;
  const digits = opts?.digits ?? 0;
  const figure = opts?.figure ?? 'percent';
  const banner = bannerHeading(column);
  const stub = String(row.label || '').trim() || 'Row';
  const respondents = finiteNumber(cell.unweighted_n);
  const baseUnweighted = finiteNumber(cell.column_unweighted_n);
  const weightedCell = finiteNumber(cell.weighted_n ?? cell.count);
  const baseWeighted = finiteNumber(cell.column_weighted_n);
  const weight = weightLabel(book, opts?.columnLabels);
  const weightAware = Boolean(
    (book.weight as { weight_aware?: boolean } | undefined)?.weight_aware
  );

  const respondentText =
    respondents != null && baseUnweighted != null
      ? `${formatCount(respondents)} of ${formatCount(baseUnweighted)}${
          column.id !== 'total' && banner ? ` · ${banner}` : ''
        }`
      : respondents != null
        ? formatCount(respondents)
        : '—';

  const weightedText =
    weightAware && weightedCell != null && baseWeighted != null
      ? `${formatCount(weightedCell, 1)} of ${formatCount(baseWeighted, 1)}${
          weight ? ` · ${weight}` : ''
        }`
      : weightAware && weight
        ? weight
        : 'Unweighted';

  const rows: NumberTraceRow[] = [
    { label: 'Respondents', value: respondentText },
    { label: 'Weighted', value: weightedText },
    { label: 'Filter', value: filterLabel(book, opts?.columnLabels) },
    {
      label: 'Significance',
      value: significanceTrace(book, row.id, column.id, letters),
    },
  ];
  const rRow = rCheckRow(book);
  if (rRow) rows.push(rRow);

  return {
    value: cellValueText(cell, digits, figure),
    context: `${stub} · ${banner}`,
    rows,
    respondentCount: respondents,
    showRespondentsLabel:
      respondents != null ? `Show the ${formatCount(respondents)} respondents` : 'Show respondents',
  };
}
