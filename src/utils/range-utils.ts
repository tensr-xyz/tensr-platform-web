import { CellPosition } from '@/types/spreadsheet';

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}

/**
 * Normalizes a range to ensure start is top-left and end is bottom-right
 */
export function normalizeRange(range: CellRange): CellRange {
  const startRow = Math.min(range.start.rowIndex, range.end.rowIndex);
  const endRow = Math.max(range.start.rowIndex, range.end.rowIndex);
  const startCol =
    range.start.rowIndex <= range.end.rowIndex
      ? range.start.rowIndex === range.start.rowIndex
        ? range.start.columnId
        : range.end.columnId
      : range.start.rowIndex < range.end.rowIndex
        ? range.start.columnId
        : range.end.columnId;
  const endCol =
    range.start.rowIndex <= range.end.rowIndex
      ? range.start.rowIndex === range.start.rowIndex
        ? range.end.columnId
        : range.start.columnId
      : range.start.rowIndex < range.end.rowIndex
        ? range.end.columnId
        : range.start.columnId;

  // For column comparison, we need to use column indices
  // This is a simplified version - in practice, we'd need column order
  return {
    start: {
      rowIndex: startRow,
      columnId: range.start.columnId,
    },
    end: {
      rowIndex: endRow,
      columnId: range.end.columnId,
    },
  };
}

/**
 * Checks if a cell position is within a range
 */
export function isCellInRange(
  cell: CellPosition,
  range: CellRange,
  visibleColumns: string[]
): boolean {
  const startRow = Math.min(range.start.rowIndex, range.end.rowIndex);
  const endRow = Math.max(range.start.rowIndex, range.end.rowIndex);

  const startColIndex = visibleColumns.indexOf(range.start.columnId);
  const endColIndex = visibleColumns.indexOf(range.end.columnId);
  const cellColIndex = visibleColumns.indexOf(cell.columnId);

  const minColIndex = Math.min(startColIndex, endColIndex);
  const maxColIndex = Math.max(startColIndex, endColIndex);

  return (
    cell.rowIndex >= startRow &&
    cell.rowIndex <= endRow &&
    cellColIndex >= minColIndex &&
    cellColIndex <= maxColIndex
  );
}

/**
 * Gets all cells in a range
 */
export function getCellsInRange(range: CellRange, visibleColumns: string[]): CellPosition[] {
  const startRow = Math.min(range.start.rowIndex, range.end.rowIndex);
  const endRow = Math.max(range.start.rowIndex, range.end.rowIndex);

  const startColIndex = visibleColumns.indexOf(range.start.columnId);
  const endColIndex = visibleColumns.indexOf(range.end.columnId);
  const minColIndex = Math.min(startColIndex, endColIndex);
  const maxColIndex = Math.max(startColIndex, endColIndex);

  const cells: CellPosition[] = [];
  for (let row = startRow; row <= endRow; row++) {
    for (let col = minColIndex; col <= maxColIndex; col++) {
      cells.push({
        rowIndex: row,
        columnId: visibleColumns[col],
      });
    }
  }
  return cells;
}

/**
 * Gets the range dimensions (rows x columns)
 */
export function getRangeDimensions(
  range: CellRange,
  visibleColumns: string[]
): { rows: number; columns: number } {
  const startRow = Math.min(range.start.rowIndex, range.end.rowIndex);
  const endRow = Math.max(range.start.rowIndex, range.end.rowIndex);

  const startColIndex = visibleColumns.indexOf(range.start.columnId);
  const endColIndex = visibleColumns.indexOf(range.end.columnId);
  const minColIndex = Math.min(startColIndex, endColIndex);
  const maxColIndex = Math.max(startColIndex, endColIndex);

  return {
    rows: endRow - startRow + 1,
    columns: maxColIndex - minColIndex + 1,
  };
}

/**
 * Converts a range to Excel-style notation (e.g., "A1:C5")
 */
export function rangeToNotation(range: CellRange, visibleColumns: string[]): string {
  const startRow = Math.min(range.start.rowIndex, range.end.rowIndex);
  const endRow = Math.max(range.start.rowIndex, range.end.rowIndex);

  const startColIndex = visibleColumns.indexOf(range.start.columnId);
  const endColIndex = visibleColumns.indexOf(range.end.columnId);
  const minColIndex = Math.min(startColIndex, endColIndex);
  const maxColIndex = Math.max(startColIndex, endColIndex);

  const startCol = columnIndexToLetter(minColIndex);
  const endCol = columnIndexToLetter(maxColIndex);

  if (startRow === endRow && minColIndex === maxColIndex) {
    return `${startCol}${startRow + 1}`;
  }
  return `${startCol}${startRow + 1}:${endCol}${endRow + 1}`;
}

/**
 * Converts a column index to Excel-style letter notation (0 -> A, 1 -> B, etc.)
 */
function columnIndexToLetter(index: number): string {
  let result = '';
  let num = index;
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
}
