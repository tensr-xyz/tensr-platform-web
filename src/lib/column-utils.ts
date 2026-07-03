/** Match a user-facing column name to a tab column (id or header, case-insensitive). */

export type ColumnLike = { id: string; header: string };

export function findColumnByLabel(columns: ColumnLike[], name: string): ColumnLike | undefined {
  const lower = name.trim().toLowerCase();
  if (!lower) return undefined;
  return columns.find(c => c.id.toLowerCase() === lower || c.header.toLowerCase() === lower);
}
