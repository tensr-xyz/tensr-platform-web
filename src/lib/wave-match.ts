/** Match a saved deck's questions onto a new wave. Name first, then label. */

export type WaveColumn = { name: string; label: string };

export type LabelMatch = { previous: string; next: string; label: string };

export type WaveMatch = {
  byName: string[];
  byLabel: LabelMatch[];
  missing: string[];
};

export function matchWave(previous: WaveColumn[], next: WaveColumn[]): WaveMatch {
  const nextByName = new Map(next.map(column => [column.name, column]));
  const nextByLabel = new Map<string, WaveColumn>();
  for (const column of next) {
    const label = column.label.trim();
    if (!label || label === column.name) continue;
    const key = label.toLowerCase();
    if (!nextByLabel.has(key)) nextByLabel.set(key, column);
  }
  const byName: string[] = [];
  const byLabel: LabelMatch[] = [];
  const missing: string[] = [];
  const used = new Set<string>();
  for (const column of previous) {
    const named = nextByName.get(column.name);
    if (named && !used.has(named.name)) {
      byName.push(column.name);
      used.add(named.name);
      continue;
    }
    const label = column.label.trim();
    const labelled = label ? nextByLabel.get(label.toLowerCase()) : undefined;
    if (labelled && !used.has(labelled.name)) {
      byLabel.push({ previous: column.name, next: labelled.name, label });
      used.add(labelled.name);
      continue;
    }
    missing.push(column.label.trim() || column.name);
  }
  return { byName, byLabel, missing };
}
