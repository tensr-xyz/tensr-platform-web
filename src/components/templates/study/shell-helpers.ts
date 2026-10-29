export function isInternalColumn(name: string): boolean {
  const column = name.trim();
  return column === '_row_uid' || column === '_weight' || column.endsWith('_coding');
}

export function visibleColumns(names: string[]): string[] {
  return names.filter(name => name && !isInternalColumn(name));
}

export type ColumnInfo = { name: string; type?: string; measure?: string };

export type ColumnSample = { names: string[]; values: unknown[][] };

/** Same rule as the API: a non-null value that does not parse as a number is not numeric. */
export function valuesAreNumeric(values: unknown[]): boolean {
  const present = values.filter(
    value => value !== null && value !== undefined && String(value).trim() !== ''
  );
  if (!present.length) return false;
  return present.every(value => Number.isFinite(Number(String(value).trim())));
}

export function columnSamples(sample: ColumnSample | undefined, name: string): unknown[] {
  if (!sample) return [];
  const index = sample.names.indexOf(name);
  if (index < 0) return [];
  return sample.values.map(row => (Array.isArray(row) ? row[index] : undefined));
}

export function isNumericColumn(column: ColumnInfo, sample?: unknown[]): boolean {
  const type = String(column.type || '').toLowerCase();
  const measure = String(column.measure || '').toLowerCase();
  if (
    type === 'numeric' ||
    type === 'number' ||
    type === 'float' ||
    type === 'double' ||
    measure === 'scale'
  ) {
    return true;
  }
  return valuesAreNumeric(sample || []);
}

export function numericColumns(columns: ColumnInfo[], sample?: ColumnSample): string[] {
  return columns
    .filter(column => column.name && isNumericColumn(column, columnSamples(sample, column.name)))
    .map(column => column.name);
}

export function categoricalColumns(columns: ColumnInfo[], sample?: ColumnSample): string[] {
  return columns
    .filter(
      column =>
        column.name &&
        !isInternalColumn(column.name) &&
        !isNumericColumn(column, columnSamples(sample, column.name))
    )
    .map(column => column.name);
}

export function datasetSwitcherLabel(dataset: {
  id: string;
  original_filename?: string;
  lineage_label?: string | null;
}): string {
  const name = (dataset.original_filename || dataset.id).trim();
  const lineage = String(dataset.lineage_label || '').trim();
  if (!lineage) return name;
  const folded = name.toLowerCase();
  const lineageFolded = lineage.toLowerCase();
  if (
    lineageFolded === folded ||
    lineageFolded.startsWith(`${folded} `) ||
    lineageFolded.startsWith(`${folded}·`) ||
    folded.endsWith(lineageFolded)
  ) {
    return lineageFolded.startsWith(folded) ? lineage : name;
  }
  return `${name} · ${lineage}`;
}

export function newestDatasetId(
  datasets: { id: string; updated_at?: string | null }[],
  activeId?: string | null
): string {
  const stamped = datasets.filter(dataset => dataset.updated_at);
  if (!stamped.length) return activeId || datasets[0]?.id || '';
  const newest = [...stamped].sort((left, right) =>
    String(right.updated_at).localeCompare(String(left.updated_at))
  )[0];
  return newest?.id || activeId || datasets[0]?.id || '';
}

export type BannerColumn = {
  id: string;
  label?: string;
  codes?: { column?: string; code?: string }[];
};

export function bannerHeading(column: BannerColumn): string {
  const code = column.codes?.[0]?.code;
  if (code != null && String(code).trim()) return String(code);
  const label = column.label || column.id;
  const split = label.indexOf('=');
  return split >= 0 ? label.slice(split + 1) : label;
}
export type BannerCell = {
  banner_id: string;
  percent?: number | null;
  column_unweighted_n?: number;
  unweighted_n?: number;
  provenance?: { row_uid_bitset?: string };
};
export type BannerRow = {
  id: string;
  label?: string;
  column?: string;
  source_text_column?: string | null;
  kind?: string;
  cells?: BannerCell[];
};
export type SigLetter = { stub_row_id?: string; banner_id?: string; letter?: string };

export function lettersFor(letters: SigLetter[], rowId: string, bannerId: string): string {
  return letters
    .filter(item => item.stub_row_id === rowId && item.banner_id === bannerId && item.letter)
    .map(item => item.letter)
    .join('');
}

export function codedStub(column: string): {
  column: string;
  multiple_response?: boolean;
  value_delimiter?: string;
} {
  if (!column.endsWith('_codes')) return { column };
  return { column, multiple_response: true, value_delimiter: '|' };
}

export function isCrosstabBook(book: Record<string, unknown> | null): boolean {
  const columns = (book?.banner_columns as BannerColumn[] | undefined) || [];
  return columns.some(column => column.id && column.id !== 'total');
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
