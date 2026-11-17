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

/** The percent values the user typed. Same encoding the agent sends for rake. */
export function targetPercents(codes: { code: string; percent: string }[]): Record<string, number> {
  const percents: Record<string, number> = {};
  for (const row of codes) {
    const percent = Number(row.percent);
    if (!row.code || row.percent.trim() === '' || !Number.isFinite(percent)) continue;
    percents[row.code] = percent;
  }
  return percents;
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

/** Start-from choice on the weighting screen. Empty = equal weights of 1. */
export const PREVIOUS_WEIGHT = '__previous__';

export type ScreenRakeOptions = {
  missingHandling?: '' | 'keep_unweighted' | 'missing_target' | 'exclude';
  missingTargets?: Record<string, string>;
  /** Lower weight bound. Blank or non-positive = no floor. */
  floor?: string;
  /** Upper weight bound. Blank or non-positive = no cap. */
  cap?: string;
  /**
   * Design weight: empty = equal 1, PREVIOUS_WEIGHT = keep the current weight,
   * otherwise a column name.
   */
  startFrom?: string;
  preview?: boolean;
};

/** Body the weighting screen posts to /weights/rake (percents, caps, design weight). */
export function buildScreenRakeBody(
  groups: { column: string; codes: { code: string; percent: string }[] }[],
  options: ScreenRakeOptions = {}
): Record<string, unknown> | null {
  const categorical: Record<string, Record<string, number>> = {};
  for (const group of groups) {
    const targets = targetPercents(group.codes);
    if (Object.keys(targets).length) categorical[group.column] = targets;
  }
  if (!Object.keys(categorical).length) return null;

  const handling = options.missingHandling || '';
  const missingTargets = Object.fromEntries(
    Object.entries(options.missingTargets || {})
      .filter(
        ([column, value]) => categorical[column] && Number.isFinite(Number(value)) && value.trim()
      )
      .map(([column, value]) => [column, Number(value)])
  );
  const lower = Number(options.floor);
  const upper = Number(options.cap);
  const startFrom = (options.startFrom || '').trim();

  return {
    categorical_targets: categorical,
    ...(handling ? { missing_handling: handling } : {}),
    ...(handling === 'missing_target' ? { missing_targets: missingTargets } : {}),
    ...(Number.isFinite(lower) && lower > 0 ? { lower } : {}),
    ...(Number.isFinite(upper) && upper > 0 ? { upper } : {}),
    ...(startFrom === PREVIOUS_WEIGHT
      ? { use_existing_weight: true }
      : startFrom
        ? { design_weight_column: startFrom }
        : {}),
    ...(options.preview ? { preview: true } : {}),
  };
}
