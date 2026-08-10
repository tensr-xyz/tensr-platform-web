/** Helpers for numeric column frequency charts in the workspace filter panel. */

export type NumericFrequencyPoint = {
  value: number;
  count: number;
  original: string;
};

export type NumericChartBucket = {
  value: number;
  count: number;
  originalValues: { value: string; count: number }[];
};

/** Parse a frequency value label into a finite number for charts/range filters. */
export function parseFrequencyNumber(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  if (raw == null) return NaN;
  const s = String(raw).trim().replace(/,/g, '');
  if (!s) return NaN;
  if (s.endsWith('%')) {
    const n = Number.parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? n : NaN;
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

export function formatRangeNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs !== 0 && abs < 1) return n.toFixed(3).replace(/\.?0+$/, '');
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Bucket numeric frequencies for the filter histogram.
 * Integer-like series (Age) keep one bar per value; continuous/fractional (FG%) are binned.
 */
export function buildNumericChartBuckets(
  points: NumericFrequencyPoint[],
  distinctCount: number
): NumericChartBucket[] {
  if (!points.length) return [];

  const values = points.map(p => p.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const dataRange = maxValue - minValue;
  const allInteger = points.every(f => Math.abs(f.value - Math.round(f.value)) < 1e-9);

  let bucketSize: number;
  if (allInteger && distinctCount <= 40 && dataRange <= 200) {
    bucketSize = 1;
  } else if (dataRange <= 0) {
    return [
      {
        value: minValue,
        count: points.reduce((sum, item) => sum + item.count, 0),
        originalValues: points.map(item => ({
          value: item.original,
          count: item.count,
        })),
      },
    ];
  } else {
    const numberOfBins = Math.max(
      8,
      Math.min(36, Math.ceil(2 * Math.pow(Math.max(distinctCount, 2), 1 / 3)))
    );
    bucketSize = dataRange / numberOfBins;
    const magnitude = Math.pow(10, Math.floor(Math.log10(bucketSize)));
    const normalizedSize = bucketSize / magnitude;
    const niceSize = [1, 2, 5, 10].find(n => n >= normalizedSize) || 10;
    bucketSize = niceSize * magnitude;
  }

  const buckets = new Map<number, NumericFrequencyPoint[]>();
  for (const point of points) {
    const key = Math.floor(point.value / bucketSize) * bucketSize;
    const list = buckets.get(key);
    if (list) list.push(point);
    else buckets.set(key, [point]);
  }

  return [...buckets.entries()]
    .map(([bucketValue, items]) => ({
      value: bucketValue,
      count: items.reduce((sum, item) => sum + item.count, 0),
      originalValues: items.map(item => ({
        value: item.original,
        count: item.count,
      })),
    }))
    .sort((a, b) => a.value - b.value);
}
