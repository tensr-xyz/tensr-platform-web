/** Columns the ANOVA dependent list may offer. A numeric companion stays even when the preview type is text. */

export type FlowColumn = {
  name: string;
  label?: string | null;
  type?: string;
  measure?: string;
  value_labels?: Record<string, string> | null;
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

/** The question type for an outline pill: single, multi, scale with its range, numeric, or open. */
export function questionKind(
  column: FlowColumn & { coded_multi?: boolean },
  values: unknown[],
  multiNames: Set<string> = new Set()
): string {
  if (column.coded_multi || multiNames.has(column.name)) return 'multi';
  const labels = Object.keys(column.value_labels || {});
  const seen = values
    .map(value => (value == null ? '' : String(value).trim()))
    .filter(value => value !== '' && value !== 'null' && value !== 'nan');
  const numbers = seen.map(Number).filter(value => Number.isFinite(value));
  const codes = labels.length ? labels.map(Number).filter(Number.isFinite) : numbers;
  const integers = codes.length > 0 && codes.every(value => Number.isInteger(value));
  const distinct = new Set(codes).size;
  const type = String(column.type || '').toLowerCase();
  if (integers && numbers.length === seen.length) {
    const min = Math.min(...codes);
    const max = Math.max(...codes);
    if ((min === 0 || min === 1) && distinct <= 2 && max <= 1) return 'single';
    if ((min === 0 || min === 1) && (max === 5 || max === 7 || max === 10) && distinct >= 3) {
      return `scale ${min}-${max}`;
    }
    if (distinct <= 12) return 'single';
  }
  if (labels.length) return 'single';
  if (['numeric', 'number', 'float', 'integer', 'double'].includes(type)) return 'numeric';
  const unique = new Set(seen).size;
  if (seen.length && unique <= 12 && unique < seen.length / 2) return 'single';
  return 'open';
}

/** A respondent or record id: by name, or because every loaded value is different. */
export function isIdColumn(name: string, values: unknown[] = []): boolean {
  if (!name.trim()) return false;
  if (isInternalColumn(name)) return true;
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  if (
    /^(resp|respondent|record|case|response|participant|panel|user|row|serial|unique)?(id|uuid|no|number|serial)$/.test(
      key
    ) ||
    /(^|[_\s-])id$/i.test(name.trim())
  ) {
    return true;
  }
  const seen = values
    .map(value => (value == null ? '' : String(value).trim()))
    .filter(value => value !== '' && value !== 'null');
  return seen.length >= 20 && new Set(seen).size === seen.length;
}
