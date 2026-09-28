export const RAKE_COPY =
  'Raking creates a new dataset version. It does not overwrite the open file (SPSS Weight Cases mutates the open file; this does not).';

export const RAKE_MISSING_CATEGORY_WARNING =
  'Rows with a missing or untargeted category are excluded and given weight 0. They stay in the dataset and are counted in the weighting summary. To impute them or add a "missing" target, say so in chat.';

export type RakeMargin = {
  column: string;
  targets: Record<string, string>;
};

export function rakeMarginFromColumn(
  column: string,
  rows: Array<Record<string, unknown>>
): RakeMargin {
  const targets: Record<string, string> = {};
  for (const row of rows) {
    const raw = row[column];
    if (raw == null) continue;
    const value = String(raw).trim();
    if (!value || value in targets) continue;
    targets[value] = '';
  }
  return { column, targets };
}

export function buildRakePayload(
  margins: RakeMargin[],
  options?: { targetsFilename?: string }
): {
  categorical_targets: Record<string, Record<string, number>>;
  missing_handling: 'exclude';
  targets_filename?: string;
} {
  const categorical_targets: Record<string, Record<string, number>> = {};
  for (const margin of margins) {
    if (!margin.column) continue;
    const cats: Record<string, number> = {};
    for (const [key, raw] of Object.entries(margin.targets)) {
      const n = Number(raw);
      if (!key || String(raw).trim() === '' || !Number.isFinite(n)) continue;
      cats[key] = n;
    }
    if (Object.keys(cats).length) categorical_targets[margin.column] = cats;
  }
  return {
    categorical_targets,
    missing_handling: 'exclude',
    ...(options?.targetsFilename ? { targets_filename: options.targetsFilename } : {}),
  };
}

const VARIABLE_HEADERS = ['variable', 'var', 'column', 'margin'];
const CATEGORY_HEADERS = ['category', 'level', 'label'];
const VALUE_HEADERS = [
  'proportion',
  'percent',
  'percentage',
  'count',
  'population',
  'target',
  'n',
  'freq',
  'frequency',
];

export function marginsFromTargetsCsv(text: string): RakeMargin[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error('A targets file needs a header and at least one row.');
  }
  const header = splitCsvLine(lines[0]).map(cell => cell.trim().toLowerCase());
  const variableIndex = header.findIndex(name => VARIABLE_HEADERS.includes(name));
  const categoryIndex = header.findIndex(name => CATEGORY_HEADERS.includes(name));
  const valueIndex = header.findIndex(name => VALUE_HEADERS.includes(name));
  if (variableIndex < 0 || categoryIndex < 0 || valueIndex < 0) {
    throw new Error(
      'A targets file needs columns for variable, category, and proportion or count.'
    );
  }
  const grouped = new Map<string, Record<string, string>>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const variable = (cells[variableIndex] || '').trim();
    const category = (cells[categoryIndex] || '').trim();
    const value = (cells[valueIndex] || '').trim();
    if (!variable || !category || !value) continue;
    const targets = grouped.get(variable) ?? {};
    targets[category] = value;
    grouped.set(variable, targets);
  }
  if (!grouped.size) throw new Error('The targets file has no usable rows.');
  return [...grouped.entries()].map(([column, targets]) => ({ column, targets }));
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
}
