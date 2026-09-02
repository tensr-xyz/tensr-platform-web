import { buildComputeBody, isComputeIdentifier } from './compute-transform';

describe('buildComputeBody', () => {
  it('builds a formula transform for SPSS-style compute', () => {
    expect(
      buildComputeBody({ target: 'age_plus_score', kind: 'formula', expr: 'age + score' })
    ).toEqual({
      transforms: [{ kind: 'formula', target: 'age_plus_score', expr: 'age + score' }],
    });
  });

  it('builds a row-mean transform', () => {
    expect(
      buildComputeBody({ target: 'item_mean', kind: 'row_mean', sources: ['q1', 'q2', 'q3'] })
    ).toEqual({
      transforms: [{ kind: 'row_mean', target: 'item_mean', sources: ['q1', 'q2', 'q3'] }],
    });
  });

  it('builds a reverse-score transform', () => {
    expect(
      buildComputeBody({
        target: 'q1_rev',
        kind: 'reverse_score',
        source: 'q1',
        subtractFrom: 6,
      })
    ).toEqual({
      transforms: [{ kind: 'reverse_score', target: 'q1_rev', source: 'q1', subtract_from: 6 }],
    });
  });

  it('rejects empty target and empty formula', () => {
    expect(buildComputeBody({ target: '', kind: 'formula', expr: 'age + 1' })).toEqual({
      error: 'Enter a name for the new variable',
    });
    expect(buildComputeBody({ target: 'x', kind: 'formula', expr: '  ' })).toEqual({
      error: 'Enter a formula using column names and + - * /',
    });
  });

  it('rejects names the compute formula parser cannot reference', () => {
    expect(isComputeIdentifier('age_plus_score')).toBe(true);
    expect(isComputeIdentifier('Q1 score')).toBe(false);
    expect(buildComputeBody({ target: 'Q1 score', kind: 'formula', expr: 'age' })).toEqual({
      error:
        'New variable name must start with a letter or underscore and contain only letters, digits, or underscores',
    });
  });
});
