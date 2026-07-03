import type { ColumnSummary } from '@/types/file';
import { cn } from '@/utils';

const TEXT_TYPES = new Set([
  'string',
  'str',
  'text',
  'categorical',
  'category',
  'boolean',
  'bool',
  'date',
  'datetime',
  'time',
  'timestamp',
]);

const NUMERIC_TYPES = new Set([
  'numeric',
  'number',
  'float',
  'double',
  'integer',
  'int',
  'decimal',
  'continuous',
]);

/** API / import column type strings and legacy column.type values. */
export function isNumericDataType(columnType?: string): boolean {
  if (!columnType) return false;
  const type = columnType.toLowerCase().trim();
  if (TEXT_TYPES.has(type)) return false;
  if (NUMERIC_TYPES.has(type)) return true;
  if (type === 'number') return true;
  if (/^(u?int\d*|float\d*|double|decimal|numeric)/.test(type)) return true;
  return false;
}

/** @deprecated use isNumericDataType */
export function isNumericColumnType(columnType?: string): boolean {
  return isNumericDataType(columnType);
}

export function getColumnSummary(
  columnKey: string,
  columnStats?: Record<string, ColumnSummary>
): ColumnSummary | undefined {
  if (!columnStats) return undefined;
  if (columnStats[columnKey]) return columnStats[columnKey];
  const byName = Object.values(columnStats).find(s => s?.name === columnKey);
  if (byName) return byName;
  const lower = columnKey.toLowerCase();
  const matchedKey = Object.keys(columnStats).find(k => k.toLowerCase() === lower);
  return matchedKey ? columnStats[matchedKey] : undefined;
}

const NUMERIC_VALUE_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

/** Infer numeric vs text from loaded row values when summaries are missing. */
export function inferNumericFromSampleValues(
  values: unknown[],
  minRatio = 0.8,
  minSamples = 3
): boolean {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonEmpty.length < minSamples) return false;

  const sample = nonEmpty.slice(0, 100);
  let numeric = 0;
  for (const v of sample) {
    if (typeof v === 'number' && !Number.isNaN(v)) {
      numeric += 1;
      continue;
    }
    const s = String(v).trim();
    if (NUMERIC_VALUE_RE.test(s) || (s !== '' && !Number.isNaN(Number(s)))) {
      numeric += 1;
    }
  }
  return numeric / sample.length >= minRatio;
}

export function columnTypeFromSummary(summary?: ColumnSummary): string | undefined {
  if (!summary) return undefined;
  if (summary.numeric_stats) return 'number';
  if (isNumericDataType(summary.data_type)) return 'number';
  return 'string';
}

export function resolveColumnIsNumeric(
  columnKey: string,
  columnStats?: Record<string, ColumnSummary>,
  initialColumnType?: string,
  loadedApiType?: string,
  sampleValues?: unknown[]
): boolean {
  if (loadedApiType) return isNumericDataType(loadedApiType);

  const stats = getColumnSummary(columnKey, columnStats);
  if (stats) {
    if (stats.numeric_stats) return true;
    if (isNumericDataType(stats.data_type)) return true;
    if (stats.categorical_stats && !isNumericDataType(stats.data_type)) return false;
  }

  if (initialColumnType === 'number') return true;
  if (isNumericDataType(initialColumnType)) return true;

  if (sampleValues?.length && inferNumericFromSampleValues(sampleValues)) return true;

  return false;
}

export function columnTypeLabel(isNumeric: boolean, variant: 'symbol' | 'hint' = 'symbol'): string {
  if (variant === 'hint') return isNumeric ? '123' : 'abc';
  return isNumeric ? '#' : 'T';
}

export function ColumnTypeBadge({
  isNumeric,
  variant = 'symbol',
  className,
}: {
  isNumeric: boolean;
  variant?: 'symbol' | 'hint';
  className?: string;
}) {
  const label = columnTypeLabel(isNumeric, variant);

  const isHint = variant === 'hint';

  return (
    <span
      className={cn(
        'shrink-0 font-mono text-[9px] font-medium leading-none',
        isHint
          ? isNumeric
            ? 'text-primary opacity-80'
            : 'text-muted-foreground/70'
          : cn(
              'grid size-3.5 place-items-center rounded-[3px] border opacity-70',
              isNumeric
                ? 'border-primary text-primary'
                : 'border-muted-foreground text-muted-foreground'
            ),
        className
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}
