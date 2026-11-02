/** Columns the ANOVA dependent list may offer. A numeric companion stays even when the preview type is text. */

export type FlowColumn = {
  name: string;
  label?: string | null;
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

/** Text open ends only. Numeric and already-coded columns stay out of the code frame. */
export function isOpenEndColumn(column: FlowColumn): boolean {
  const name = column.name.trim();
  if (!name || name.endsWith('_codes')) return false;
  const type = String(column.type || '').toLowerCase();
  if (
    type === 'numeric' ||
    type === 'number' ||
    type === 'float' ||
    type === 'double' ||
    type === 'id'
  ) {
    return false;
  }
  const measure = String(column.measure || '').toLowerCase();
  if (measure === 'scale' || measure === 'ordinal') return false;
  return type === 'string' || type === 'text' || type === '' || measure === 'nominal';
}

export function openEndColumns(columns: FlowColumn[]): string[] {
  return columns
    .filter(column => column.name && isOpenEndColumn(column))
    .map(column => column.name);
}
