import { isNumericDataType } from '@/components/molecules/column-type-badge';

export type SchemaColumnType = {
  name?: string;
  type?: string | null;
  storage_type?: string | null;
};

/**
 * Filter and badge type for one schema column.
 * `type` follows the series (numeric codes stay numeric). Storage type is kept
 * on the payload for SPSS, and an id stored as text stays text.
 */
export function dataTypeFromSchemaColumn(column: SchemaColumnType): string {
  if (isNumericDataType(column.type || undefined)) return 'numeric';
  if (isNumericDataType(column.storage_type || undefined) && column.type == null) {
    return 'numeric';
  }
  return column.type ? String(column.type) : 'string';
}

/** Grid badge type. Numeric schema columns are numeric before analyze-file runs. */
export function columnTypeFromSchemaColumn(column: SchemaColumnType): 'number' | 'string' {
  return isNumericDataType(dataTypeFromSchemaColumn(column)) ? 'number' : 'string';
}
