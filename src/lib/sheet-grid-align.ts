/** Map preview columns onto the visible sheet when lineage columns are hidden. */

export type SheetColumnRef = { id?: string };

const SYNTHETIC_ROW_ID = /^row-\d+$/;

/** Non-enumerable, so a column can use any name, including "id". */
export const GRID_ROW_KEY: unique symbol = Symbol.for('tensr.gridRowKey');

export function isSyntheticRowKey(key: string, row: Record<string, unknown>): boolean {
  if (key !== 'id') return false;
  const value = row[key];
  return typeof value === 'string' && SYNTHETIC_ROW_ID.test(value);
}

/** Column names on a grid row. A bookkeeping id of the form row-N is not a column. */
export function gridDataKeys(row: Record<string, unknown> | null | undefined): string[] {
  if (!row) return [];
  return Object.keys(row).filter(key => !isSyntheticRowKey(key, row));
}

function stampRowKey(row: Record<string, unknown>, key: string): Record<string, unknown> {
  Object.defineProperty(row, GRID_ROW_KEY, {
    value: key,
    enumerable: false,
    writable: true,
  });
  return row;
}

/**
 * Column-major preview data is indexed by the full variable list, including
 * hidden `_row_uid` / `_source_row_uids`. Visible columns are a subset, so a
 * positional zip shifts later cells (the weight column shows UUIDs).
 */
export function alignColumnMajorToColumns(
  columnMajor: unknown[][],
  sourceColumnIds: string[],
  columns: SheetColumnRef[]
): unknown[][] {
  return columns.map((col, visibleIndex) => {
    const id = col.id || '';
    const sourceIndex = id ? sourceColumnIds.indexOf(id) : -1;
    const idx = sourceIndex >= 0 ? sourceIndex : visibleIndex;
    return columnMajor[idx] ?? [];
  });
}

/** Row-major preview.rows, aligned to visible columns by variable name. */
export function gridRowsFromPreview(
  sourceColumnIds: string[],
  rows: unknown[][],
  columns: SheetColumnRef[],
  startRow = 0
): Array<Record<string, unknown>> {
  const columnMajor = sourceColumnIds.map((_, colIdx) =>
    rows.map(row => (Array.isArray(row) ? row[colIdx] : undefined))
  );
  return gridRowsForColumns(columnMajor, sourceColumnIds, columns, startRow);
}

/** Records already keyed by column id, still passed through the same alignment. */
export function gridRowsFromStoredRecords(
  records: Array<Record<string, unknown>>,
  columns: SheetColumnRef[],
  startRow = 0
): Array<Record<string, unknown>> {
  const visible = columns.map(col => col.id || '').filter(Boolean);
  const first = records[0];
  const extras = first
    ? Object.keys(first).filter(key => !visible.includes(key) && !isSyntheticRowKey(key, first))
    : [];
  const sourceIds = [...extras, ...visible];
  const columnMajor = sourceIds.map(id => records.map(row => row[id]));
  return gridRowsForColumns(columnMajor, sourceIds, columns, startRow);
}

export function gridRowsForColumns(
  columnMajor: unknown[][],
  sourceColumnIds: string[],
  columns: SheetColumnRef[],
  startRow = 0
): Array<Record<string, unknown>> {
  if (!columnMajor[0]) return [];
  const aligned = alignColumnMajorToColumns(columnMajor, sourceColumnIds, columns);
  const rowCount = aligned[0]?.length ?? columnMajor[0].length;
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: Record<string, unknown> = {};
    columns.forEach((col, colIndex) => {
      if (col.id) row[col.id] = aligned[colIndex]?.[rowIndex];
    });
    return stampRowKey(row, `row-${startRow + rowIndex}`);
  });
}
