/** Columns the ANOVA dependent list may offer. A numeric companion stays even when the preview type is text. */

export type FlowColumn = {
  name: string;
  type?: string;
  measure?: string;
};

export function isDependentColumn(column: FlowColumn): boolean {
  const name = column.name.trim();
  if (!name) return false;
  if (name.endsWith('_numeric')) return true;
  const measure = String(column.measure || '').toLowerCase();
  if (measure === 'scale') return true;
  const type = String(column.type || '').toLowerCase();
  return type === 'numeric' || type === 'number' || type === 'float' || type === 'double';
}

export function dependentColumns(columns: FlowColumn[]): string[] {
  return columns
    .filter(column => column.name && isDependentColumn(column))
    .map(column => column.name);
}
