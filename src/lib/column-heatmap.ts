/** Brand purple heatmap — diverging percentile scale (DataSpell / Excel style). */

export const HEATMAP_BRAND = { h: 250, s: 100, l: 63 } as const;
/** Faint cool tint for low percentiles (bottom third). */
export const HEATMAP_COOL = { h: 230, s: 55, l: 72 } as const;

const THIRD = 100 / 3;
/** Top-third opacity: 40% → 50% at max percentile. */
const OPACITY_TOP_MIN = 0.4;
const OPACITY_TOP_MAX = 0.5;
/** Middle-third opacity: ~10% → ~28%. */
const OPACITY_MID_MIN = 0.1;
const OPACITY_MID_MAX = 0.28;
/** Bottom-third cool tint (only upper part of band; lower stays clear). */
const OPACITY_COOL_MAX = 0.07;

export type ColumnHeatmapScale = {
  /** Ascending numeric values (visible rows) for percentile lookup. */
  sortedValues: number[];
};

export function parseNumericCellValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const s = String(value).trim().replace(/,/g, '');
  if (s === '' || s === 'null' || s === 'undefined') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Collect and sort numeric values for percentile-based scaling. */
export function computeColumnHeatmapScale(
  rows: Record<string, unknown>[],
  columnId: string
): ColumnHeatmapScale | null {
  const values: number[] = [];
  for (const row of rows) {
    const n = parseNumericCellValue(row[columnId]);
    if (n !== null) values.push(n);
  }
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  return { sortedValues: values };
}

/**
 * Empirical percentile rank in [0, 100] within sorted values (0th–100th).
 * Ties share the average index so duplicates don't collapse the gradient.
 */
export function valuePercentileRank(value: number, sortedValues: number[]): number {
  const n = sortedValues.length;
  if (n === 0) return 0;
  if (n === 1) return 100;

  if (value <= sortedValues[0]) return 0;
  if (value >= sortedValues[n - 1]) return 100;

  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedValues[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  const idx = lo;

  if (idx < n && sortedValues[idx] === value) {
    let start = idx;
    while (start > 0 && sortedValues[start - 1] === value) start -= 1;
    let end = idx;
    while (end < n && sortedValues[end] === value) end += 1;
    const avgIndex = (start + end - 1) / 2;
    return (avgIndex / (n - 1)) * 100;
  }

  const v0 = sortedValues[idx - 1];
  const v1 = sortedValues[idx];
  const t = v1 === v0 ? 0 : (value - v0) / (v1 - v0);
  const rank = idx - 1 + t;
  return (rank / (n - 1)) * 100;
}

/**
 * Diverging background from percentile:
 * - Bottom third: clear → faint cool tint
 * - Middle third: light brand purple
 * - Top third: strong brand purple (40–50% opacity)
 */
export function heatmapBackgroundFromPercentile(percentile: number): string | undefined {
  const p = Math.max(0, Math.min(100, percentile));

  if (p < THIRD) {
    const t = p / THIRD;
    if (t < 0.2) return undefined;
    const opacity = ((t - 0.2) / 0.8) * OPACITY_COOL_MAX;
    return `hsla(${HEATMAP_COOL.h}, ${HEATMAP_COOL.s}%, ${HEATMAP_COOL.l}%, ${opacity})`;
  }

  if (p < 2 * THIRD) {
    const t = (p - THIRD) / THIRD;
    const opacity = OPACITY_MID_MIN + t * (OPACITY_MID_MAX - OPACITY_MID_MIN);
    return `hsla(${HEATMAP_BRAND.h}, ${HEATMAP_BRAND.s}%, ${HEATMAP_BRAND.l}%, ${opacity})`;
  }

  const t = (p - 2 * THIRD) / THIRD;
  const opacity = OPACITY_TOP_MIN + t * (OPACITY_TOP_MAX - OPACITY_TOP_MIN);
  return `hsla(${HEATMAP_BRAND.h}, ${HEATMAP_BRAND.s}%, ${HEATMAP_BRAND.l}%, ${opacity})`;
}

export function heatmapBackgroundForValue(
  value: number,
  scale: ColumnHeatmapScale
): string | undefined {
  const percentile = valuePercentileRank(value, scale.sortedValues);
  return heatmapBackgroundFromPercentile(percentile);
}

/** @deprecated Use computeColumnHeatmapScale + heatmapBackgroundForValue */
export function computeColumnHeatmapRange(
  rows: Record<string, unknown>[],
  columnId: string
): { min: number; max: number } | null {
  const scale = computeColumnHeatmapScale(rows, columnId);
  if (!scale) return null;
  const { sortedValues: v } = scale;
  return { min: v[0], max: v[v.length - 1] };
}
