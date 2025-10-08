/**
 * Utility functions for data analysis and manipulation
 */

/**
 * Check if a column is numeric based on its type or data content
 * @param col - The column object with id, type, and header properties
 * @param data - The actual data rows to check
 * @returns boolean indicating if the column is numeric
 */
export function isNumericColumn(col: any, data?: any[]): boolean {
  // Check for explicit numeric types
  if (
    col.type === 'number' ||
    col.type === 'numeric' ||
    col.type === 'integer' ||
    col.type === 'float'
  ) {
    return true;
  }

  // Fallback: check if the column data can be parsed as numbers
  if (data && data.length > 0) {
    const sampleValues = data.slice(0, 10).map((row: any) => row[col.id]);
    const numericValues = sampleValues.filter(
      (val: any) => val != null && val !== '' && !isNaN(parseFloat(val))
    );
    // Consider it numeric if at least 70% of sample values can be parsed as numbers
    return numericValues.length >= sampleValues.length * 0.7;
  }

  return false;
}

/**
 * Get all numeric columns from a dataset
 * @param columns - Array of column objects
 * @param data - The actual data rows
 * @returns Array of numeric columns
 */
export function getNumericColumns(columns: any[], data?: any[]): any[] {
  return columns.filter(col => isNumericColumn(col, data));
}
