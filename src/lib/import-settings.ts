import { columnTypeFromSummary } from '@/components/molecules/column-type-badge';
import type { ColumnSummary } from '@/types/file';

export interface ImportSettings {
  delimiter: string;
  customDelimiter?: string;
  textQualifier: string;
  hasHeaders: boolean;
  trimSpaces: boolean;
  skipEmptyRows: boolean;
  columnTypes: Record<string, string>;
  columnNames: string[];
}

export function buildDefaultImportSettings(
  columnNames: string[],
  delimiter: string = ',',
  columnSummaries?: Record<string, ColumnSummary>
): ImportSettings {
  return {
    delimiter,
    textQualifier: '"',
    hasHeaders: true,
    trimSpaces: false,
    skipEmptyRows: true,
    columnNames: [...columnNames],
    columnTypes: Object.fromEntries(
      columnNames.map(name => [name, columnTypeFromSummary(columnSummaries?.[name]) ?? 'string'])
    ),
  };
}
