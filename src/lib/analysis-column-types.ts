import type { SchemaColumn } from '@/lib/analysis-report-types';

/** Column slot types used in analysis dialog badges and validation. */
export type ColumnSlotType = 'numeric' | 'categorical' | 'date/time' | 'string';

const HIDDEN_ROLES = new Set(['stacked_source', 'helper', 'system']);

/** A column a person can pick. Leading-underscore fields and helper roles stay hidden. */
export function isListedColumn(column: { name: string; role?: string | null }): boolean {
  const name = column.name.trim();
  if (!name || name.startsWith('_')) return false;
  return !HIDDEN_ROLES.has(String(column.role || '').toLowerCase());
}

/** A weight is not a default factor. The weight control still offers it. */
export function isWeightColumn(column: { role?: string | null }): boolean {
  return String(column.role || '').toLowerCase() === 'weight';
}

/**
 * A column a numeric slot can use as an outcome.
 * Ordinal and scale are numeric outcomes. Nominal is not. A weight stays in the weight picker.
 */
export function isNumericOutcome(column: SchemaColumn | undefined): boolean {
  if (!column || !isListedColumn(column) || isWeightColumn(column)) return false;
  const measure = String(column.measure || '').toLowerCase();
  if (measure === 'nominal') return false;
  if (measure === 'ordinal' || measure === 'scale') return true;
  return schemaColumnSlotType(column) === 'numeric';
}

export function numericOutcomeNames(schema: SchemaColumn[]): string[] {
  return schema.filter(column => isNumericOutcome(column)).map(column => column.name);
}

/** Label first, stored name second, wherever a picker lists a column. */
export function columnHeading(
  column: { name: string; label?: string | null } | undefined,
  name: string
): { primary: string; secondary: string } {
  const label = String(column?.label || '').trim();
  if (label && label !== name) return { primary: label, secondary: name };
  return { primary: name, secondary: '' };
}

export function schemaColumnSlotType(col: SchemaColumn | undefined): ColumnSlotType {
  if (!col) return 'string';
  const t = (col.type || '').toLowerCase();
  if (t === 'numeric' || t.includes('int') || t.includes('float') || t === 'number')
    return 'numeric';
  if (t.includes('date') || t.includes('time') || t === 'timestamp') return 'date/time';
  if (t === 'string' || t === 'str' || t === 'text') return 'string';
  if (t.includes('bool')) return 'categorical';
  return 'categorical';
}

export function columnSlotType(schema: SchemaColumn[], name: string): ColumnSlotType {
  const c = schema.find(x => x.name === name);
  return schemaColumnSlotType(c);
}

export function slotTypeLabel(slot: ColumnSlotType): string {
  return slot;
}

export function slotTypeMatchesExpected(
  actual: ColumnSlotType,
  expected: ColumnSlotType,
  column?: SchemaColumn
): boolean {
  const measure = String(column?.measure || '').toLowerCase();
  if (measure === 'ordinal') return expected === 'numeric' || expected === 'categorical';
  if (measure === 'nominal') return expected === 'categorical' || expected === 'string';
  if (measure === 'scale') return expected === 'numeric';
  if (actual === expected) return true;
  if (expected === 'categorical' && (actual === 'categorical' || actual === 'string')) return true;
  return false;
}

export const SLOT_BADGE_CLASS: Record<ColumnSlotType, string> = {
  numeric: 'bg-secondary text-muted-foreground',
  categorical: 'bg-secondary text-muted-foreground',
  'date/time': 'bg-secondary text-muted-foreground',
  string: 'bg-secondary text-muted-foreground',
};

/** Paper's warn tone, not a red alarm. */
export const SLOT_BADGE_MISMATCH_CLASS = 'bg-[#F6EDE2] text-[#8A4B12]';

/** @deprecated Prefer columnSlotType — kept for transitional imports. */
export function typeBadgeLabel(schema: SchemaColumn[], name: string): string {
  return slotTypeLabel(columnSlotType(schema, name));
}
