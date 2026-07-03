import { Column } from '@/types/visualiser/spreadsheet';

export type ColumnType = 'numeric' | 'categorical' | 'date' | 'text';

export interface ColumnStats {
  type: ColumnType;
  count: number;
  nullCount: number;
  uniqueCount?: number;
  // Numeric stats
  mean?: number;
  min?: number;
  max?: number;
  stdDev?: number;
  // Categorical stats
  topValues?: Array<{ value: string; count: number }>;
  // Date stats
  dateRange?: { min: string; max: string };
}

export interface SchemaSummary {
  totalRows: number;
  totalColumns: number;
  columns: Array<{
    name: string;
    type: ColumnType;
    stats: ColumnStats;
  }>;
  summaryText: string;
}

/**
 * Detects the type of a column based on its values
 */
export function detectColumnType(values: any[]): ColumnType {
  if (values.length === 0) return 'text';

  const nonNullValues = values.filter(v => v != null && v !== '');

  if (nonNullValues.length === 0) return 'text';

  // Check for dates
  const datePattern = /^\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4}/;
  const dateCount = nonNullValues.filter(v => {
    if (typeof v === 'string') {
      return datePattern.test(v) || !isNaN(Date.parse(v));
    }
    return v instanceof Date;
  }).length;

  if (dateCount / nonNullValues.length > 0.8) {
    return 'date';
  }

  // Check for numeric
  const numericCount = nonNullValues.filter(v => {
    if (typeof v === 'number') return true;
    if (typeof v === 'string') {
      const trimmed = v.trim().replace(/[,$%]/g, '');
      return !isNaN(Number(trimmed)) && trimmed !== '';
    }
    return false;
  }).length;

  if (numericCount / nonNullValues.length > 0.8) {
    return 'numeric';
  }

  // Check for categorical (limited unique values)
  const uniqueValues = new Set(nonNullValues.map(v => String(v).toLowerCase()));
  const uniqueRatio = uniqueValues.size / nonNullValues.length;

  if (uniqueRatio < 0.5 && uniqueValues.size < 50) {
    return 'categorical';
  }

  return 'text';
}

/**
 * Computes statistics for a specific column
 */
export function computeColumnStats(data: Record<string, any>[], columnName: string): ColumnStats {
  const values = data.map(row => row[columnName]).filter(v => v != null && v !== '');
  const type = detectColumnType(values);

  const stats: ColumnStats = {
    type,
    count: data.length,
    nullCount: data.length - values.length,
    uniqueCount: new Set(values.map(v => String(v))).size,
  };

  if (type === 'numeric') {
    const numericValues = values
      .map(v => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          const cleaned = v.trim().replace(/[,$%]/g, '');
          const num = Number(cleaned);
          return isNaN(num) ? null : num;
        }
        return null;
      })
      .filter((v): v is number => v !== null);

    if (numericValues.length > 0) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      stats.mean = sum / numericValues.length;
      stats.min = Math.min(...numericValues);
      stats.max = Math.max(...numericValues);

      // Standard deviation
      const variance =
        numericValues.reduce((acc, val) => acc + Math.pow(val - stats.mean!, 2), 0) /
        numericValues.length;
      stats.stdDev = Math.sqrt(variance);
    }
  } else if (type === 'categorical') {
    const valueCounts = new Map<string, number>();
    values.forEach(v => {
      const key = String(v).toLowerCase();
      valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
    });

    stats.topValues = Array.from(valueCounts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  } else if (type === 'date') {
    const dates = values
      .map(v => {
        if (v instanceof Date) return v;
        if (typeof v === 'string') {
          const parsed = Date.parse(v);
          return isNaN(parsed) ? null : new Date(parsed);
        }
        return null;
      })
      .filter((v): v is Date => v !== null);

    if (dates.length > 0) {
      const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
      stats.dateRange = {
        min: sorted[0].toISOString().split('T')[0],
        max: sorted[sorted.length - 1].toISOString().split('T')[0],
      };
    }
  }

  return stats;
}

/**
 * Generates a human-readable summary text from schema and stats
 */
function generateSummaryText(summary: Omit<SchemaSummary, 'summaryText'>): string {
  const lines: string[] = [];

  lines.push(
    `Dataset: ${summary.totalRows.toLocaleString()} rows, ${summary.totalColumns} columns.`
  );

  const numericCols = summary.columns.filter(c => c.stats.type === 'numeric');
  const categoricalCols = summary.columns.filter(c => c.stats.type === 'categorical');
  const dateCols = summary.columns.filter(c => c.stats.type === 'date');

  // Limit to top 3 columns per type to keep summary concise
  if (numericCols.length > 0) {
    lines.push(`Numeric (${numericCols.length}):`);
    numericCols.slice(0, 3).forEach(col => {
      const mean = col.stats.mean?.toFixed(1) || 'N/A';
      lines.push(`${col.name}: mean=${mean}`);
    });
  }

  if (categoricalCols.length > 0) {
    lines.push(`Categorical (${categoricalCols.length}):`);
    categoricalCols.slice(0, 3).forEach(col => {
      const top = col.stats.topValues?.[0]?.value || 'N/A';
      lines.push(`${col.name}: top="${top}"`);
    });
  }

  if (dateCols.length > 0) {
    lines.push(`Date (${dateCols.length}):`);
    dateCols.slice(0, 2).forEach(col => {
      const range = col.stats.dateRange
        ? `${col.stats.dateRange.min} to ${col.stats.dateRange.max}`
        : 'N/A';
      lines.push(`${col.name}: ${range}`);
    });
  }

  return lines.join(' ');
}

/**
 * Computes a complete schema summary for a dataset
 */
export function computeSchemaSummary(
  data: Record<string, any>[],
  columns: Column[]
): SchemaSummary {
  const columnStats = columns.map(col => ({
    name: col.id,
    type: detectColumnType(data.map(row => row[col.id])),
    stats: computeColumnStats(data, col.id),
  }));

  const summary: Omit<SchemaSummary, 'summaryText'> = {
    totalRows: data.length,
    totalColumns: columns.length,
    columns: columnStats,
  };

  return {
    ...summary,
    summaryText: generateSummaryText(summary),
  };
}
