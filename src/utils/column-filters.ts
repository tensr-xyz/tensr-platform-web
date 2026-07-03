/** Client-side row filtering for workspace preview grids (filter panel + agent). */

export type TabColumnFilter = {
  id: string;
  value: {
    operator: string;
    value: unknown;
  };
};

export function applyClientColumnFilters<T extends Record<string, unknown>>(
  rows: T[],
  filters: TabColumnFilter[]
): T[] {
  if (!filters.length) return rows;

  return rows.filter(row =>
    filters.every(filter => {
      const cell = row[filter.id];
      const cellStr = cell == null ? '' : String(cell);
      const { operator, value } = filter.value;
      const valStr = value == null ? '' : String(value);

      switch (operator) {
        case 'in': {
          const allowed = valStr.split('\x1e').filter(Boolean);
          return allowed.length === 0 || allowed.includes(cellStr);
        }
        case 'equals':
          return cellStr === valStr;
        case 'contains':
          return cellStr.toLowerCase().includes(valStr.toLowerCase());
        case 'greaterThan':
          return Number(cell) > Number(valStr);
        case 'lessThan':
          return Number(cell) < Number(valStr);
        default:
          return true;
      }
    })
  );
}

export function buildInFilter(columnName: string, values: Set<string>): TabColumnFilter | null {
  if (values.size === 0) return null;
  return {
    id: columnName,
    value: {
      operator: 'in',
      value: Array.from(values).join('\x1e'),
    },
  };
}

export function mergeColumnFilter(
  existing: TabColumnFilter[] | undefined,
  columnName: string,
  values: Set<string>
): TabColumnFilter[] {
  const rest = (existing ?? []).filter(f => f.id !== columnName);
  const next = buildInFilter(columnName, values);
  return next ? [...rest, next] : rest;
}
