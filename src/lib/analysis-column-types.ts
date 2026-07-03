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
  numeric: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
  categorical: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  'date/time': 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
  string: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
};

export const SLOT_BADGE_MISMATCH_CLASS =
  'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200';

/** @deprecated Prefer columnSlotType — kept for transitional imports. */
export function typeBadgeLabel(schema: SchemaColumn[], name: string): string {
  return slotTypeLabel(columnSlotType(schema, name));
}
