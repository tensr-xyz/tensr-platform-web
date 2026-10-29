export function isInternalColumn(name: string): boolean {
  const column = name.trim();
  return column === '_row_uid' || column === '_weight' || column.endsWith('_coding');
}

export function visibleColumns(names: string[]): string[] {
  return names.filter(name => name && !isInternalColumn(name));
}

export type ColumnInfo = { name: string; type?: string; measure?: string };

export function isNumericColumn(column: ColumnInfo): boolean {
  const type = String(column.type || '').toLowerCase();
  const measure = String(column.measure || '').toLowerCase();
  return (
    type === 'numeric' ||
    type === 'number' ||
    type === 'float' ||
    type === 'double' ||
    measure === 'scale'
  );
}

export function numericColumns(columns: ColumnInfo[]): string[] {
  return columns
    .filter(column => column.name && isNumericColumn(column))
    .map(column => column.name);
}

export function categoricalColumns(columns: ColumnInfo[]): string[] {
  return columns
    .filter(column => column.name && !isInternalColumn(column.name) && !isNumericColumn(column))
    .map(column => column.name);
}

export function datasetSwitcherLabel(dataset: {
  id: string;
  original_filename?: string;
  lineage_label?: string | null;
}): string {
  const name = dataset.original_filename || dataset.id;
  const lineage = String(dataset.lineage_label || '').trim();
  return lineage ? `${name} · ${lineage}` : name;
}

/** Kish efficiency is a ratio. The dialog shows it as a percentage. */
export function efficiencyPercent(value: unknown): string {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '';
  const percent = number <= 1 ? number * 100 : number;
  return `${percent.toFixed(1)}%`;
}

export function looksLikeCrosstab(markdown: string): boolean {
  return /\|.+\|/.test(markdown) && /%/.test(markdown);
}

export function codedColumns(names: string[]): string[] {
  return visibleColumns(names).filter(name => name.endsWith('_codes') || !name.startsWith('_'));
}
