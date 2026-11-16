import {
  achievedShare,
  categoryMeanWeight,
  countsFromPercents,
  marginFor,
  shareLabel,
  targetPercents,
} from './weight-targets';

describe('weight modal', () => {
  it('sends the typed percents, the same encoding the agent uses', () => {
    expect(
      targetPercents([
        { code: 'East', percent: '25' },
        { code: 'West', percent: '75' },
        { code: 'Blank', percent: '' },
      ])
    ).toEqual({ East: 25, West: 75 });
  });

  it('still converts percents to counts when a caller asks for expansion totals', () => {
    expect(countsFromPercents([{ code: 'East', percent: '25' }], 400)).toEqual({ East: 100 });
    expect(countsFromPercents([{ code: 'East', percent: '' }], 400)).toEqual({});
  });

  it('reads the weighted share and the category mean from the rake margin', () => {
    const margin = marginFor(
      [{ column: 'region', level: 'East', achieved: 100 }],
      'region',
      'East'
    );
    expect(shareLabel(0.182)).toBe('18.2%');
    expect(achievedShare(margin?.achieved || 0, 400)).toBe('25.0%');
    expect(categoryMeanWeight(100, 80)).toBe('1.25');
  });
});
