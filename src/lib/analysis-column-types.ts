import type { SchemaColumn } from '@/lib/analysis-report-types';

/** Column slot types used in analysis dialog badges and validation. */
export type ColumnSlotType = 'numeric' | 'categorical' | 'date/time' | 'string';

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

export function slotTypeMatchesExpected(actual: ColumnSlotType, expected: ColumnSlotType): boolean {
  if (actual === expected) return true;
  if (expected === 'numeric' && actual === 'numeric') return true;
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
