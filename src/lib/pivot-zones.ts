export type PivotZone = 'rows' | 'columns' | 'values' | 'filters';

export type PivotAgg =
  | 'count'
  | 'sum'
  | 'mean'
  | 'median'
  | 'min'
  | 'max'
  | 'pct_row'
  | 'pct_column'
  | 'pct_total';

export type PivotField = {
  id: string;
  column: string;
  zone: PivotZone;
  agg?: PivotAgg;
};

export const PIVOT_AGGS: { id: PivotAgg; label: string }[] = [
  { id: 'count', label: 'Count' },
  { id: 'sum', label: 'Sum' },
  { id: 'mean', label: 'Mean' },
  { id: 'median', label: 'Median' },
  { id: 'min', label: 'Min' },
  { id: 'max', label: 'Max' },
  { id: 'pct_row', label: '% of row' },
  { id: 'pct_column', label: '% of column' },
  { id: 'pct_total', label: '% of total' },
];

const ENGINE_AGGS = new Set<PivotAgg>(['count', 'pct_row', 'pct_column', 'pct_total']);

export function significanceSupported(agg: PivotAgg | undefined): boolean {
  return !!agg && ENGINE_AGGS.has(agg);
}

export function fieldsInZone(fields: PivotField[], zone: PivotZone): PivotField[] {
  return fields.filter(field => field.zone === zone);
}

export function moveField(
  fields: PivotField[],
  id: string,
  zone: PivotZone,
  index: number
): PivotField[] {
  const current = fields.find(field => field.id === id);
  if (!current) return fields;
  const next = fields.filter(field => field.id !== id);
  const placed: PivotField = {
    ...current,
    zone,
    agg: zone === 'values' ? current.agg || 'sum' : undefined,
  };
  const zoneIds = next.filter(field => field.zone === zone);
  const others = next.filter(field => field.zone !== zone);
  const at = Math.max(0, Math.min(index, zoneIds.length));
  zoneIds.splice(at, 0, placed);
  return [...others, ...zoneIds];
}

export function removeField(fields: PivotField[], id: string): PivotField[] {
  return fields.filter(field => field.id !== id);
}

export function swapRowsAndColumns(fields: PivotField[]): PivotField[] {
  return fields.map(field => {
    if (field.zone === 'rows') return { ...field, zone: 'columns' };
    if (field.zone === 'columns') return { ...field, zone: 'rows' };
    return field;
  });
}

export function reorderField(fields: PivotField[], id: string, direction: -1 | 1): PivotField[] {
  const field = fields.find(item => item.id === id);
  if (!field) return fields;
  const zone = fieldsInZone(fields, field.zone);
  const index = zone.findIndex(item => item.id === id);
  return moveField(fields, id, field.zone, index + direction);
}

export function setFieldAgg(fields: PivotField[], id: string, agg: PivotAgg): PivotField[] {
  return fields.map(field => (field.id === id ? { ...field, agg } : field));
}

export function pivotBody(
  fields: PivotField[],
  options: {
    topN: number | null;
    significance: boolean;
    showSubtotals: boolean;
    showGrandTotal: boolean;
    filters: { column: string; value: string }[];
  }
): Record<string, unknown> {
  const rows = fieldsInZone(fields, 'rows').map(field => field.column);
  const columns = fieldsInZone(fields, 'columns').map(field => field.column);
  const values = fieldsInZone(fields, 'values').map(field => {
    const agg = field.agg || 'sum';
    const countsOnly = agg === 'count' || agg.startsWith('pct_');
    if (countsOnly && (!field.column || field.column === 'count' || field.column === agg)) {
      return { agg };
    }
    return { column: field.column, agg };
  });
  const filterClauses = options.filters
    .filter(filter => filter.column && filter.value)
    .map(filter => ({ column: filter.column, op: '=', value: filter.value }));
  return {
    rows,
    columns,
    values: values.length ? values : [{ agg: 'count' }],
    top_n: options.topN,
    significance: options.significance,
    show_subtotals: options.showSubtotals,
    show_grand_total: options.showGrandTotal,
    filter: filterClauses.length ? { combine: 'and', filters: filterClauses } : undefined,
  };
}

export function fieldsFromPivotConfig(
  config: Record<string, unknown> | null | undefined
): PivotField[] {
  if (!config) return [];
  const fields: PivotField[] = [];
  const push = (zone: PivotZone, column: string, agg?: PivotAgg) => {
    if (!column) return;
    fields.push({ id: `${zone}:${column}:${fields.length}`, column, zone, agg });
  };
  for (const column of asStrings(config.rows)) push('rows', column);
  for (const column of asStrings(config.columns)) push('columns', column);
  const values = Array.isArray(config.values) ? config.values : [];
  for (const value of values) {
    if (!value || typeof value !== 'object') continue;
    const record = value as { column?: string; agg?: PivotAgg };
    push('values', String(record.column || 'count'), record.agg || 'count');
  }
  return fields;
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item));
}
