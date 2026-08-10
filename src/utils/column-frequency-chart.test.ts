import {
  buildNumericChartBuckets,
  formatRangeNumber,
  parseFrequencyNumber,
} from './column-frequency-chart';

describe('parseFrequencyNumber', () => {
  it('parses plain decimals used by percentage columns', () => {
    expect(parseFrequencyNumber('0.432')).toBeCloseTo(0.432);
    expect(parseFrequencyNumber(0.522)).toBeCloseTo(0.522);
    expect(parseFrequencyNumber('1')).toBe(1);
  });

  it('rejects empty labels (legacy API null encoding)', () => {
    expect(Number.isFinite(parseFrequencyNumber(''))).toBe(false);
    expect(Number.isFinite(parseFrequencyNumber(null))).toBe(false);
    expect(Number.isFinite(parseFrequencyNumber(undefined))).toBe(false);
  });

  it('supports percent suffixes and commas', () => {
    expect(parseFrequencyNumber('43.2%')).toBeCloseTo(43.2);
    expect(parseFrequencyNumber('1,234.5')).toBeCloseTo(1234.5);
  });
});

describe('formatRangeNumber', () => {
  it('keeps fractional precision for 0–1 columns', () => {
    expect(formatRangeNumber(0.432)).toMatch(/^0\.432/);
  });

  it('formats integers without decimals', () => {
    expect(formatRangeNumber(24)).toBe('24');
  });
});

describe('buildNumericChartBuckets', () => {
  it('keeps one bucket per integer age value', () => {
    const points = [19, 20, 21, 22, 23, 24].map(value => ({
      value,
      count: 1,
      original: String(value),
    }));
    const buckets = buildNumericChartBuckets(points, points.length);
    expect(buckets).toHaveLength(6);
    expect(buckets.map(b => b.value)).toEqual([19, 20, 21, 22, 23, 24]);
  });

  it('does not collapse FG%-style 0–1 values into a single bucket', () => {
    const points = [0.0, 0.25, 0.4, 0.45, 0.5, 0.55, 0.7, 0.9, 1.0].map(value => ({
      value,
      count: 2,
      original: String(value),
    }));
    const buckets = buildNumericChartBuckets(points, points.length);
    expect(buckets.length).toBeGreaterThan(1);
    const min = Math.min(...buckets.map(b => b.value));
    const max = Math.max(...buckets.map(b => b.value));
    expect(min).toBeLessThanOrEqual(0.1);
    expect(max).toBeGreaterThanOrEqual(0.9);
  });
});
