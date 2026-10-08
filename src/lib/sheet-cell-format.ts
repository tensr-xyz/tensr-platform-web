/** Weight columns are long floats. Four decimal places fit the sheet cell. */
const WEIGHT_COLUMN = /(^|_)weight$/i;

export function formatSheetCellDisplay(value: unknown, columnId?: string): string {
  if (value === null || value === undefined) return '';
  if (!columnId || !WEIGHT_COLUMN.test(columnId)) return String(value);
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(number)) return String(value);
  return number.toFixed(4);
}
