export const RAKE_COPY =
  'Raking creates a new dataset version. It does not overwrite the open file (SPSS Weight Cases mutates the open file; this does not).';

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

export function buildRakePayload(margins: RakeMargin[]): {
  categorical_targets: Record<string, Record<string, number>>;
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
  return { categorical_targets };
}
