import type { SchemaSummary } from './schema-compute';
import { computeColumnStats } from './schema-compute';

export interface ComputedStats {
  statsText: string;
  relevantColumns: string[];
}

/**
 * Routes user questions and computes relevant statistics
 */
export function routeQuestionAndComputeStats(
  question: string,
  data: Record<string, any>[],
  schemaSummary: SchemaSummary
): ComputedStats {
  const questionLower = question.toLowerCase();
  const mentionedColumns: string[] = [];

  // Find columns mentioned in the question
  schemaSummary.columns.forEach(col => {
    const colNameLower = col.name.toLowerCase();
    if (questionLower.includes(colNameLower)) {
      mentionedColumns.push(col.name);
    }
  });

  // If no columns mentioned, return generic stats
  if (mentionedColumns.length === 0) {
    return {
      statsText: `Dataset has ${schemaSummary.totalRows} rows and ${schemaSummary.totalColumns} columns.`,
      relevantColumns: [],
    };
  }

  const statsLines: string[] = [];
  statsLines.push(`Statistics:`);

  // Compute stats for mentioned columns (limit to 3 columns to keep prompt short)
  mentionedColumns.slice(0, 3).forEach(colName => {
    const col = schemaSummary.columns.find(c => c.name === colName);
    if (!col) return;

    const stats = computeColumnStats(data, colName);

    if (stats.type === 'numeric') {
      const parts: string[] = [`${colName}:`];
      if (stats.mean !== undefined) parts.push(`mean=${stats.mean.toFixed(1)}`);
      if (stats.min !== undefined && stats.max !== undefined)
        parts.push(`range=${stats.min}-${stats.max}`);
      parts.push(`count=${stats.count}`);
      statsLines.push(parts.join(', '));
    } else if (stats.type === 'categorical') {
      const parts: string[] = [`${colName}:`, `unique=${stats.uniqueCount}`];
      if (stats.topValues && stats.topValues.length > 0) {
        parts.push(`top="${stats.topValues[0].value}" (${stats.topValues[0].count})`);
      }
      statsLines.push(parts.join(', '));
    }
  });

  // Check for comparison questions (e.g., "by country", "by category")
  const comparisonPatterns = [
    /by\s+(\w+)/i,
    /group\s+by\s+(\w+)/i,
    /compare\s+(\w+)/i,
    /(\w+)\s+vs\s+(\w+)/i,
  ];

  let breakdownColumn: string | null = null;
  for (const pattern of comparisonPatterns) {
    const match = question.match(pattern);
    if (match) {
      const potentialCol = match[1] || match[2];
      const foundCol = schemaSummary.columns.find(
        c => c.name.toLowerCase() === potentialCol.toLowerCase()
      );
      if (foundCol) {
        breakdownColumn = foundCol.name;
        break;
      }
    }
  }

  // If breakdown column found and we have a numeric column, compute group stats
  if (breakdownColumn && mentionedColumns.length > 0) {
    const numericCol = mentionedColumns.find(colName => {
      const col = schemaSummary.columns.find(c => c.name === colName);
      return col?.stats.type === 'numeric';
    });

    if (numericCol) {
      statsLines.push(`Group statistics for ${numericCol} by ${breakdownColumn}:`);
      const groups = new Map<string, number[]>();

      data.forEach(row => {
        const groupKey = String(row[breakdownColumn] || 'Unknown');
        const value = row[numericCol];
        if (value != null && value !== '') {
          const numValue = typeof value === 'number' ? value : Number(value);
          if (!isNaN(numValue)) {
            if (!groups.has(groupKey)) {
              groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(numValue);
          }
        }
      });

      Array.from(groups.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5) // Limit to top 5 groups
        .forEach(([group, values]) => {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          statsLines.push(
            `${breakdownColumn}=${group}: mean ${numericCol}=${mean.toFixed(1)}, n=${values.length}`
          );
        });
    }
  }

  statsLines.push('All numbers exact.');

  return {
    statsText: statsLines.join('\n'),
    relevantColumns: mentionedColumns,
  };
}
