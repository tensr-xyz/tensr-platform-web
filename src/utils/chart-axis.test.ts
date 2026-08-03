import {
  formatDateTick,
  formatNumberTick,
  inferDateResolution,
  maxCharsForWidth,
  niceTicks,
  parseAxisDate,
  planCategoryLabels,
  truncateLabel,
  valuesLookLikeDatetime,
} from './chart-axis';

describe('niceTicks', () => {
  it('returns readable intervals covering the range', () => {
    const ticks = niceTicks(0, 100, 5);
    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(8);
  });

  it('handles a degenerate min===max range', () => {
    const ticks = niceTicks(5, 5, 4);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('formatNumberTick', () => {
  it('avoids trailing decimals for integer-valued data', () => {
    expect(formatNumberTick(20, [0, 10, 20])).toBe('20');
    expect(formatNumberTick(1000, [0, 500, 1000])).toBe('1,000');
  });

  it('keeps decimals when the range is fractional', () => {
    const label = formatNumberTick(0.25, [0.1, 0.25, 0.5]);
    expect(label).toMatch(/0\.25|0\.3/);
  });
});

describe('truncateLabel / planCategoryLabels', () => {
  it('does not truncate when space allows', () => {
    const plan = planCategoryLabels(['North', 'South'], 80, 12, 'comfortable', 56);
    expect(plan.rotate).toBe(false);
    expect(truncateLabel('North', plan.maxChars)).toBe('North');
  });

  it('rotates long labels instead of hard-capping at 8 chars', () => {
    const labels = [
      'Queen Elizabeth Olympic Park East Gate',
      'Victoria Park West Pavilion Entrance',
      'Hackney Wick Canal Towpath Access',
    ];
    const plan = planCategoryLabels(labels, 40, 9, 'inline', 44);
    expect(plan.rotate).toBe(true);
    expect(plan.maxChars).toBeGreaterThan(8);
    expect(maxCharsForWidth(200, 12)).toBeGreaterThan(10);
  });
});

describe('datetime axis helpers', () => {
  it('detects ISO date categories', () => {
    expect(valuesLookLikeDatetime(['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01'])).toBe(
      true
    );
    expect(valuesLookLikeDatetime(['Team A', 'Team B', 'Team C'])).toBe(false);
  });

  it('formats by inferred resolution', () => {
    const months = [
      new Date('2024-01-15T00:00:00Z'),
      new Date('2024-06-15T00:00:00Z'),
      new Date('2024-12-15T00:00:00Z'),
    ];
    expect(inferDateResolution(months)).toBe('month');
    expect(formatDateTick(months[0]!, 'month')).toMatch(/Jan.*2024/);
  });

  it('parses epoch milliseconds', () => {
    const d = parseAxisDate(Date.UTC(2024, 0, 15));
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2024);
  });
});
