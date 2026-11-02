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

/** System columns stay out of every picker: row ids, coding scratch, and stored theme codes. */
export function isInternalColumn(name: string): boolean {
  const trimmed = name.trim();
  return (
    !trimmed || trimmed.startsWith('_') || trimmed.endsWith('_coding') || trimmed.endsWith('_codes')
  );
}

export function pickerColumns<T extends { name: string }>(columns: T[]): T[] {
  return columns.filter(column => !isInternalColumn(column.name));
}

/** Coded open ends for the Theme picker. The value is the stored codes column, the label its open end. */
export function themeColumns(
  columns: { name: string; label?: string | null }[]
): { value: string; label: string }[] {
  return columns
    .filter(column => column.name.endsWith('_codes'))
    .map(column => {
      const label = String(column.label || '')
        .replace(/^Codes for\s+/i, '')
        .trim();
      return { value: column.name, label: label || column.name.replace(/_codes$/, '') };
    });
}
