/** Pure helpers for the Responses filter panel (Paper 4i). */

export type FlowFilter = { column: string; op: 'is_any_of' | 'is_none_of'; values: string[] };

/** GET /datasets/{id}/columns/{col}/values */
export type ColumnValues = {
  column: string;
  values: string[];
  counts: Record<string, number>;
  missing: number;
  n: number;
  value_labels?: Record<string, string>;
};

/** One clause for POST /datasets/{id}/chart-data `filters`. */
export type ChartFilter = { id: string; operator: 'in'; value: string };

/** One clause for analysis `row_filters` (equals / notEquals, ANDed). */
export type RowFilter = { column: string; op: 'equals' | 'notEquals'; value: string };

/** The chart-data route joins "in" values with the ASCII record separator. */
export const IN_SEPARATOR = '\x1e';

export function valueLabel(value: string, labels?: Record<string, string> | null): string {
  const label = labels?.[value];
  return label && label !== value ? label : value;
}

function joinWords(parts: string[], word: 'or' | 'and'): string {
  if (parts.length <= 1) return parts[0] || '';
  return `${parts.slice(0, -1).join(', ')} ${word} ${parts[parts.length - 1]}`;
}

/** "Region is not Northern Ireland", "Q20 switch is Very likely or Fairly likely". */
export function describeFilter(
  filter: FlowFilter,
  column?: { name: string; label?: string; value_labels?: Record<string, string> | null }
): string {
  const name = column?.label || filter.column;
  const values = filter.values.map(value => valueLabel(value, column?.value_labels));
  if (!values.length) return `${name} (choose a value)`;
  if (filter.op === 'is_none_of') return `${name} is not ${joinWords(values, 'or')}`;
  return `${name} is ${joinWords(values, 'or')}`;
}

export function describeFilters(
  filters: FlowFilter[],
  columns: { name: string; label?: string; value_labels?: Record<string, string> | null }[]
): string {
  const ready = filters.filter(filter => filter.values.length);
  if (!ready.length) return 'Everyone';
  return ready
    .map(filter =>
      describeFilter(
        filter,
        columns.find(column => column.name === filter.column)
      )
    )
    .join(' and ');
}

/** The route compares raw cell text, so a float column stores "1.0" where the counts say "1". */
function withNumericTwins(values: string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    out.push(value);
    if (/^-?\d+$/.test(value)) out.push(`${value}.0`);
  }
  return [...new Set(out)];
}

/**
 * Filters for POST /chart-data, which ANDs clauses and supports "in".
 * "is none of" becomes "in" the other known values, so blank answers do not match it.
 * `empty` is true when a clause can match no answered row at all.
 */
export function chartFilterPayload(
  filters: FlowFilter[],
  valuesByColumn: Record<string, ColumnValues | undefined>
): { filters: ChartFilter[]; empty: boolean } {
  const out: ChartFilter[] = [];
  let empty = false;
  for (const filter of filters) {
    if (!filter.values.length) continue;
    let allowed = filter.values;
    if (filter.op === 'is_none_of') {
      const known = valuesByColumn[filter.column]?.values;
      if (!known) continue;
      const blocked = new Set(filter.values);
      allowed = known.filter(value => !blocked.has(value));
      if (!allowed.length) {
        empty = true;
        continue;
      }
    }
    out.push({
      id: filter.column,
      operator: 'in',
      value: withNumericTwins(allowed).join(IN_SEPARATOR),
    });
  }
  return { filters: out, empty };
}

/**
 * Analysis row_filters for the same subset, or null when it cannot be said with
 * equals / notEquals clauses (more than one value under "is any of").
 */
export function rowFiltersPayload(filters: FlowFilter[]): RowFilter[] | null {
  const out: RowFilter[] = [];
  for (const filter of filters) {
    if (!filter.values.length) continue;
    if (filter.op === 'is_any_of') {
      if (filter.values.length > 1) return null;
      out.push({ column: filter.column, op: 'equals', value: filter.values[0] });
    } else {
      for (const value of filter.values) {
        out.push({ column: filter.column, op: 'notEquals', value });
      }
    }
  }
  return out;
}

/** Rows one condition keeps on its own, from whole-file counts. */
export function conditionCount(filter: FlowFilter, info: ColumnValues | undefined): number | null {
  if (!info) return null;
  const picked = filter.values.reduce((sum, value) => sum + (info.counts[value] || 0), 0);
  return filter.op === 'is_any_of' ? picked : info.n - picked;
}

export function sameFilter(a: FlowFilter | undefined, b: FlowFilter | undefined): boolean {
  if (!a || !b) return false;
  return (
    a.column === b.column &&
    a.op === b.op &&
    a.values.length === b.values.length &&
    a.values.every((value, index) => value === b.values[index])
  );
}

export function sharePercent(match: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((match / total) * 100)}%`;
}
