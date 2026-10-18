import { formatEligibleIf, parseEligibleIf } from './eligible-if';

describe('eligible_if text', () => {
  it('parses a gate and joins several clauses', () => {
    expect(parseEligibleIf('owns_A=1 & source_wave=FR')).toEqual([
      { column: 'owns_A', op: '=', value: '1' },
      { column: 'source_wave', op: '=', value: 'FR' },
    ]);
  });

  it('round-trips a parsed rule', () => {
    const clauses = parseEligibleIf('owns_A==1');
    expect(formatEligibleIf(clauses)).toBe('owns_A=1');
  });

  it('ignores a fragment that is not a clause', () => {
    expect(parseEligibleIf('not a rule')).toEqual([]);
  });
});
