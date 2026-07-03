import type { ColumnMetadata } from '@/lib/analysis-report-types';

export type MeasurementLevel = 'scale' | 'ordinal' | 'nominal';

export const MEASUREMENT_LEVELS: MeasurementLevel[] = ['scale', 'ordinal', 'nominal'];

export function isMeasurementLevel(value: unknown): value is MeasurementLevel {
  return value === 'scale' || value === 'ordinal' || value === 'nominal';
}

/** Default when metadata has no explicit measure. */
export function defaultMeasurementLevel(isNumeric: boolean): MeasurementLevel {
  return isNumeric ? 'scale' : 'nominal';
}

export function resolveMeasurementLevel(
  columnMeta: ColumnMetadata | undefined,
  isNumeric: boolean
): MeasurementLevel {
  const stored = columnMeta?.measure;
  if (isMeasurementLevel(stored)) return stored;
  return defaultMeasurementLevel(isNumeric);
}
