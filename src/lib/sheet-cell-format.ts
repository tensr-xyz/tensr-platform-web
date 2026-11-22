/** Design / raked weight columns: name contains "weight" (weight, weight_5, design_weight). */
const WEIGHT_COLUMN = /weight/i;

/** Paper 4a Responses sheet: weight cells are two decimal places, not raw floats. */
const WEIGHT_DECIMALS = 2;

export function isWeightColumnId(columnId?: string | null): boolean {
  return Boolean(columnId && WEIGHT_COLUMN.test(columnId));
}

export function formatSheetCellDisplay(value: unknown, columnId?: string): string {
  if (value === null || value === undefined) return '';
  if (!isWeightColumnId(columnId)) return String(value);
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(number)) return String(value);
  return number.toFixed(WEIGHT_DECIMALS);
}

/**
 * Responses sheet column subtitle (Paper 4a): "abc" / "123" only — never
 * nominal, ordinal, or scale. Numeric storage (including labelled codes) is
 * 123; text and categorical measures are abc.
 */
export function sheetColumnHint(
  meta?: {
    type?: string | null;
    measure?: string | null;
  } | null
): string {
  const type = String(meta?.type || '').toLowerCase();
  const measure = String(meta?.measure || '').toLowerCase();
  if (
    ['numeric', 'number', 'float', 'integer', 'double', 'int'].includes(type) ||
    measure === 'scale'
  ) {
    return '123';
  }
  if (
    measure === 'nominal' ||
    measure === 'ordinal' ||
    ['categorical', 'string', 'text', 'boolean', 'id', 'date'].includes(type)
  ) {
    return 'abc';
  }
  if (type) return 'abc';
  return '\u00a0';
}

/** Variable inspector line: "Single choice · ordinal · 5 codes" when labelled. */
export function variablePanelKind(
  meta?: {
    type?: string | null;
    measure?: string | null;
    value_labels?: Record<string, string> | null;
  } | null,
  codeCount = 0
): string {
  const measure = String(meta?.measure || '').toLowerCase();
  const labels = meta?.value_labels || {};
  const labelled = Object.keys(labels).length >= 2;
  const level =
    measure === 'nominal' || measure === 'ordinal' || measure === 'scale'
      ? measure
      : String(meta?.type || '').trim();
  const bits: string[] = [];
  if (labelled && (measure === 'nominal' || measure === 'ordinal')) {
    bits.push('Single choice');
  }
  if (level) bits.push(level);
  if (codeCount > 0) {
    bits.push(`${codeCount} code${codeCount === 1 ? '' : 's'}`);
  }
  return bits.join(' · ');
}
