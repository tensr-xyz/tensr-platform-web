import { anovaError, countedPairs, formatStat, pPhrase, pairText } from './anova-result';

describe('anova result', () => {
  it('formats a real p-value and a significant pair', () => {
    expect(pPhrase(0.0004)).toBe('p < .001');
    expect(pPhrase(0.002)).toBe('p = .002');
    expect(formatStat(18.44, 1)).toBe('18.4');
    expect(
      pairText({ group1: 'East', group2: 'North', meandiff: 0.7, 'p-adj': 0.002, reject: true })
    ).toBe('East > North · +0.7 · p = .002');
  });

  it('counts pairs the test did not reject and reads an API error', () => {
    expect(countedPairs([{ reject: true }, { reject: false }, { reject: false }]).other).toBe(2);
    expect(anovaError(new Error('{"detail":"Need at least two groups"}'))).toBe(
      'Need at least two groups'
    );
  });
});
