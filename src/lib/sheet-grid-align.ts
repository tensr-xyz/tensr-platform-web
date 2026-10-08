/** Map preview columns onto the visible sheet when lineage columns are hidden. */

export type SheetColumnRef = { id?: string };

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
): Array<Record<string, unknown> & { id: string }> {
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
): Array<Record<string, unknown> & { id: string }> {
  const visible = columns.map(col => col.id || '').filter(Boolean);
  const extras = records[0]
    ? Object.keys(records[0]).filter(key => key !== 'id' && !visible.includes(key))
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
): Array<Record<string, unknown> & { id: string }> {
  if (!columnMajor[0]) return [];
  const aligned = alignColumnMajorToColumns(columnMajor, sourceColumnIds, columns);
  const rowCount = aligned[0]?.length ?? columnMajor[0].length;
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: Record<string, unknown> & { id: string } = {
      id: `row-${startRow + rowIndex}`,
    };
    columns.forEach((col, colIndex) => {
      if (col.id) row[col.id] = aligned[colIndex]?.[rowIndex];
    });
    return row;
  });
}
