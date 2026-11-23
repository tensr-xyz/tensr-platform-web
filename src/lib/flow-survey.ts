import type { AnalysisReportChart } from './analysis-report-types';
import { significanceFootnoteLine, type TableSignificanceSettings } from './table-significance';

export type BannerColumn = {
  id: string;
  label?: string;
  column_label?: string;
  letter_slot?: string;
  codes?: { column?: string; code?: string }[];
};

export type BannerCell = {
  banner_id: string;
  stub_row_id?: string;
  percent?: number | null;
  projected_thousands?: number | null;
  index?: number | null;
  row_percent?: number | null;
  total_percent?: number | null;
  count?: number | null;
  mean?: number | null;
  low_base?: boolean;
  column_unweighted_n?: number;
  column_weighted_n?: number;
  unweighted_n?: number;
  weighted_n?: number;
  effective_base?: number | null;
  standard_error?: number | null;
  z_statistic?: number | null;
  missing_count?: number | null;
  column_responses_percent?: number | null;
  ci_low?: number | null;
  ci_high?: number | null;
  provenance?: {
    row_uid_bitset?: string;
    origin_bitsets?: Record<string, { row_uid_bitset?: string }>;
    provenance_unavailable?: string;
  };
};

/** Extra stacked lines for statistics beyond the Show chips (Paper 5d). */
export function extraCellStatLines(
  cell: BannerCell | undefined,
  statistics: string[],
  digits = 1
): string[] {
  if (!cell) return [];
  const kinds = new Set(statistics);
  const lines: string[] = [];
  if (kinds.has('z_statistic') && typeof cell.z_statistic === 'number') {
    lines.push(`z ${cell.z_statistic.toFixed(Math.max(digits, 2))}`);
  }
  if (kinds.has('standard_error') && typeof cell.standard_error === 'number') {
    lines.push(`se ${cell.standard_error.toFixed(Math.max(digits, 3))}`);
  }
  if (kinds.has('effective_base') && typeof cell.effective_base === 'number') {
    lines.push(`eff ${formatGroupedNumber(cell.effective_base, 0)}`);
  }
  if (kinds.has('missing_count') && typeof cell.missing_count === 'number') {
    lines.push(`miss ${formatGroupedNumber(cell.missing_count, 0)}`);
  }
  if (
    kinds.has('confidence_interval') &&
    typeof cell.ci_low === 'number' &&
    typeof cell.ci_high === 'number'
  ) {
    lines.push(`ci ${cell.ci_low.toFixed(digits)}–${cell.ci_high.toFixed(digits)}%`);
  }
  if (kinds.has('column_responses_percent') && typeof cell.column_responses_percent === 'number') {
    lines.push(`resp ${cell.column_responses_percent.toFixed(digits)}%`);
  }
  return lines;
}

export type BannerRow = {
  id: string;
  label?: string;
  column?: string;
  source_text_column?: string | null;
  kind?: string;
  /** Stub letter when paired item tests run inside a banner column (TEN-190). */
  letter_slot?: string;
  cells?: BannerCell[];
};

export type SigLetter = {
  stub_row_id?: string;
  banner_id?: string;
  letter?: string;
  comparison_type?: string;
};

export type SurveyCell = {
  bitset: string;
  textColumn: string;
  claim: string;
  base: string;
  weight: string;
  percent: string;
  n: string;
  letter: string;
  /** When the book came from a slim analyze run, Evidence can restore the bitset. */
  runId?: string;
  stubRowId?: string;
  bannerId?: string;
};

export function bannerHeading(column: BannerColumn): string {
  const raw = column.label || column.id;
  const splitAt = raw.indexOf('=');
  const value = raw && raw !== column.id && splitAt >= 0 ? raw.slice(splitAt + 1) : raw;
  const generic = value.trim().toLowerCase();
  const variable = (column.column_label || '').trim();
  if (
    (generic === 'selected' || generic === 'not selected') &&
    variable &&
    variable.toLowerCase() !== 'selected' &&
    variable.toLowerCase() !== 'not selected'
  ) {
    const item = variable.includes(':') ? variable.split(':').slice(1).join(':').trim() : variable;
    return generic === 'not selected' ? `Not ${item || variable}` : item || variable;
  }
  const label = value;
  if (label && label !== column.id) {
    const split = label.indexOf('=');
    return split >= 0 ? label.slice(split + 1) : label;
  }
  const code = column.codes?.[0]?.code;
  if (code != null && String(code).trim()) return String(code);
  const split = label.indexOf('=');
  return split >= 0 ? label.slice(split + 1) : label;
}

/** Concatenate column letters in A–Z order; keep uppercase when both cases appear. */
export function concatenateLetters(chars: string[]): string {
  const best = new Map<string, string>();
  for (const raw of chars) {
    const letter = String(raw || '').trim();
    if (!letter) continue;
    const key = letter.toUpperCase();
    const prior = best.get(key);
    if (!prior || (prior === prior.toLowerCase() && letter === letter.toUpperCase())) {
      best.set(key, letter === letter.toUpperCase() ? key : letter);
    }
  }
  return [...best.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map(key => best.get(key) || key)
    .join('');
}

export function lettersFor(letters: SigLetter[], rowId: string, bannerId: string): string {
  const onCell = letters.filter(
    item => item.stub_row_id === rowId && item.banner_id === bannerId && item.letter
  );
  // Column letters and paired McNemar row letters never share a cell.
  const hasColumn = onCell.some(item => item.comparison_type !== 'paired_item');
  const chosen = hasColumn ? onCell.filter(item => item.comparison_type !== 'paired_item') : onCell;
  return concatenateLetters(chosen.map(item => String(item.letter || '')));
}

export function codedStub(
  column: string,
  meta?: {
    coded_multi?: boolean;
    multi_response?: boolean;
    code_delimiter?: string | null;
    source_text_column?: string | null;
  }
): {
  column: string;
  multiple_response?: boolean;
  value_delimiter?: string;
} {
  const name = String(column || '').trim();
  const multi =
    name.endsWith('_codes') ||
    name.endsWith('_themes') ||
    Boolean(meta?.coded_multi) ||
    Boolean(meta?.multi_response) ||
    Boolean(String(meta?.source_text_column || '').trim());
  if (!multi) return { column: name || column };
  const delimiter = String(meta?.code_delimiter || '|').trim() || '|';
  return { column: name || column, multiple_response: true, value_delimiter: delimiter };
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

/** Whole or projected figures with thousands separators (en-GB). */
export function formatGroupedNumber(value: number, places = 0): string {
  if (!Number.isFinite(value)) return '';
  const digits = Math.max(0, Math.trunc(places));
  if (digits <= 0) return Math.round(value).toLocaleString('en-GB');
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Column %, projected thousands, and index in one cell when those stats are toggled on. */
export function mediaCellText(
  cell: BannerCell | undefined,
  figure: 'percent' | 'row_percent' | 'total_percent' = 'percent',
  digits = 1,
  options?: { includeProjected?: boolean; includeIndex?: boolean }
): string {
  if (!cell) return '—';
  const value =
    figure === 'row_percent'
      ? cell.row_percent
      : figure === 'total_percent'
        ? cell.total_percent
        : cell.percent;
  let shown = value != null ? `${value.toFixed(digits)}%` : '—';
  if (figure === 'percent') {
    const includeProjected = options?.includeProjected === true;
    const projected = cell.projected_thousands;
    if (includeProjected && typeof projected === 'number' && Number.isFinite(projected)) {
      const count = formatGroupedNumber(projected, 1).replace(/\.0$/, '');
      const labelled = `${count}k`;
      shown = shown === '—' ? labelled : `${shown} · ${labelled}`;
    }
    const includeIndex = options?.includeIndex === true;
    const index = cell.index;
    if (includeIndex && typeof index === 'number' && Number.isFinite(index)) {
      const idx = `idx ${Math.round(index).toLocaleString('en-GB')}`;
      shown = shown === '—' ? idx : `${shown} · ${idx}`;
    }
  }
  return shown;
}

/** Paper 5d stacked cell lines: percent, projected+index, unweighted n — only toggled stats. */
export function mediaCellLines(
  cell: BannerCell | undefined,
  digits = 1,
  options?: { includeProjected?: boolean; includeUnweighted?: boolean; includeIndex?: boolean }
): { percent: string; detail: string; base: string } {
  if (!cell) return { percent: '—', detail: '', base: '' };
  const percent =
    cell.percent != null && Number.isFinite(cell.percent)
      ? `${cell.percent.toFixed(digits)}%`
      : '—';
  const parts: string[] = [];
  const includeProjected = options?.includeProjected === true;
  const projected = cell.projected_thousands;
  if (includeProjected && typeof projected === 'number' && Number.isFinite(projected)) {
    const rounded = formatGroupedNumber(projected, projected >= 100 ? 0 : 1).replace(/\.0$/, '');
    parts.push(`${rounded}k`);
  }
  const includeIndex = options?.includeIndex === true;
  const index = cell.index;
  if (includeIndex && typeof index === 'number' && Number.isFinite(index)) {
    parts.push(`idx ${Math.round(index).toLocaleString('en-GB')}`);
  }
  const includeUnweighted = options?.includeUnweighted === true;
  const n = cell.unweighted_n;
  const base =
    includeUnweighted && typeof n === 'number' && Number.isFinite(n)
      ? `n ${formatGroupedNumber(n)}`
      : '';
  return { percent, detail: parts.join(' · '), base };
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
  const runId = String(book.run_id || book.analysis_run_id || '').trim();
  const stubRowId = String(cell.stub_row_id || row.id || '').trim();
  const bannerId = String(cell.banner_id || '').trim();
  return {
    bitset,
    textColumn: row.source_text_column || row.column || '',
    claim: [row.label, percent, count ? `n ${count}` : ''].filter(Boolean).join(' · '),
    base: cell.column_unweighted_n != null ? String(cell.column_unweighted_n) : '',
    weight: weight ? String(weight) : '',
    percent,
    n: count,
    letter,
    ...(runId ? { runId } : {}),
    ...(stubRowId ? { stubRowId } : {}),
    ...(bannerId ? { bannerId } : {}),
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
export function bannerFootnote(
  book: Record<string, unknown>,
  settings?: TableSignificanceSettings | null
): string {
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
  const sigLine = significanceFootnoteLine(book, settings);
  if (sigLine) parts.push(sigLine);
  else {
    const letters = book.letters as unknown[] | undefined;
    if (String(book.significance_display || '') !== 'none' && letters?.length) {
      const named = String(book.letter_test || '').trim();
      if (book.paired_within_items || named.toLowerCase().startsWith('paired')) {
        parts.push(named || 'Paired McNemar test at 95%');
      } else {
        parts.push(named || 'Column proportions test at 95%');
      }
    }
  }
  return parts.join(' · ');
}

export type BannerChartValue = { name: string; value: number; letter?: string };
export type BannerChartSeries = { label: string; values: BannerChartValue[] };

/** Footnote for charts that draw the same column letters as the table. */
export function chartSignificanceNote(book: Record<string, unknown> | null): string | undefined {
  if (!book) return undefined;
  const letters = book.letters as unknown[] | undefined;
  if (String(book.significance_display || '') === 'none' || !letters?.length) return undefined;
  const named = String(book.letter_test || '').trim();
  if (book.paired_within_items || named.toLowerCase().startsWith('paired')) {
    return named || 'Paired McNemar test at 95%. Letters mark significant differences.';
  }
  return (
    named || 'Column proportions test at 95%. Letters mark columns that are significantly higher.'
  );
}

/** The same cells the table shows, as one series per row (with column letters when tested). */
export function chartSeriesFromBook(book: Record<string, unknown> | null): BannerChartSeries[] {
  if (!book) return [];
  const rows = ((book.rows as BannerRow[]) || []).filter(
    row => row.label && row.kind !== 'net' && row.kind !== 'base' && row.kind !== 'mean'
  );
  const hosts = bannerColumns(book).filter(column => column.id !== 'total');
  const columns = hosts.length ? hosts : bannerColumns(book);
  const letters = (book.letters as SigLetter[]) || [];
  const showLetters =
    String(book.significance_display || '') !== 'none' && letters.some(item => item.letter);
  return rows
    .map(row => ({
      label: String(row.label),
      values: columns.map(column => {
        const found = (row.cells || []).find(item => item.banner_id === column.id);
        const raw =
          typeof found?.percent === 'number' ? found.percent : Number(found?.unweighted_n ?? 0);
        const letter = showLetters ? lettersFor(letters, row.id, column.id) : '';
        return {
          name: bannerHeading(column),
          value: Number.isFinite(raw) ? raw : 0,
          ...(letter ? { letter } : {}),
        };
      }),
    }))
    .filter(row => row.values.some(item => item.value));
}

/** Chart kinds that remap the same banner cells (Displayr table ↔ visualization). */
export type BannerChartKind = 'bar' | 'line' | 'area' | 'pie';

export const BANNER_CHART_KINDS: { value: BannerChartKind; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'pie', label: 'Pie' },
];

function seriesLetters(values: BannerChartValue[], categories: string[]): string[] | undefined {
  const letters = categories.map(
    name => values.find(item => item.name === name)?.letter?.trim() || ''
  );
  return letters.some(Boolean) ? letters : undefined;
}

/**
 * Same table cells as a report chart. Pie uses one series across categories:
 * a single stub row → pie of banner columns; several rows → pie of the first column.
 * Column letters (and significance_note) match the table when the book was tested.
 */
export function chartFromBannerSeries(
  series: BannerChartSeries[],
  kind: BannerChartKind,
  opts?: { title?: string; yLabel?: string; significanceNote?: string }
): AnalysisReportChart | null {
  if (!series.length) return null;
  const title = opts?.title || '';
  const y_label = opts?.yLabel || 'Percent';
  const significance_note = opts?.significanceNote?.trim() || undefined;

  if (kind === 'pie') {
    if (series.length === 1) {
      const row = series[0]!;
      const letters = seriesLetters(
        row.values,
        row.values.map(item => item.name)
      );
      return {
        kind: 'pie',
        title,
        categories: row.values.map(item => item.name),
        values: row.values.map(item => item.value),
        ...(letters ? { letters } : {}),
        ...(significance_note ? { significance_note } : {}),
      };
    }
    const column = series[0]?.values[0]?.name;
    const letters = series.map(row => {
      const cell = row.values.find(item => item.name === column) ?? row.values[0];
      return cell?.letter?.trim() || '';
    });
    return {
      kind: 'pie',
      title,
      categories: series.map(row => row.label),
      values: series.map(
        row => row.values.find(item => item.name === column)?.value ?? row.values[0]?.value ?? 0
      ),
      ...(letters.some(Boolean) ? { letters } : {}),
      ...(significance_note ? { significance_note } : {}),
    };
  }

  const categories = series[0]!.values.map(item => item.name);
  const chartSeries = series.map(row => {
    const values = categories.map(name => row.values.find(item => item.name === name)?.value ?? 0);
    const letters = seriesLetters(row.values, categories);
    return {
      name: row.label,
      values,
      ...(letters ? { letters } : {}),
    };
  });

  if (kind === 'bar') {
    return {
      kind: 'bar_grouped',
      title,
      x_label: '',
      y_label,
      categories,
      series: chartSeries,
      ...(significance_note ? { significance_note } : {}),
    };
  }

  return {
    kind,
    title,
    x_label: '',
    y_label,
    categories,
    series: chartSeries,
    ...(significance_note ? { significance_note } : {}),
  };
}
