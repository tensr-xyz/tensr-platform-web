export type WeightCode = {
  code: string;
  count: number;
  percentage: number;
};

export type WeightMargin = {
  column: string;
  level: string;
  achieved: number;
};

export function shareLabel(percentage: number): string {
  if (!Number.isFinite(percentage)) return '';
  return `${(percentage * 100).toFixed(1)}%`;
}

export function countsFromPercents(
  codes: { code: string; percent: string }[],
  base: number
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!Number.isFinite(base) || base <= 0) return counts;
  for (const row of codes) {
    const percent = Number(row.percent);
    if (!row.code || row.percent.trim() === '' || !Number.isFinite(percent)) continue;
    counts[row.code] = (percent / 100) * base;
  }
  return counts;
}

export function achievedShare(achieved: number, base: number): string {
  if (!Number.isFinite(achieved) || !Number.isFinite(base) || base <= 0) return '';
  return `${((achieved / base) * 100).toFixed(1)}%`;
}

export function categoryMeanWeight(achieved: number, count: number): string {
  if (!Number.isFinite(achieved) || !Number.isFinite(count) || count <= 0) return '';
  return (achieved / count).toFixed(2);
}

export function marginFor(
  margins: WeightMargin[] | undefined,
  column: string,
  code: string
): WeightMargin | undefined {
  return (margins || []).find(row => row.column === column && row.level === code);
}
