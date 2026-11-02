import {
  achievedShare,
  categoryMeanWeight,
  countsFromPercents,
  marginFor,
  shareLabel,
} from './weight-targets';

describe('weight modal', () => {
  it('turns a target percent into a count on the column base', () => {
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
