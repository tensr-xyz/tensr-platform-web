import { dependentColumns, openEndColumns } from './flow-columns';

describe('ANOVA dependent columns', () => {
  it('keeps a numeric companion when the preview type is text and id is the only numeric type', () => {
    const names = dependentColumns([
      { name: 'id', type: 'numeric' },
      { name: 'agree_value_numeric', type: 'string', measure: 'nominal' },
      { name: 'comment', type: 'string' },
    ]);
    expect(names).toContain('agree_value_numeric');
    expect(names).toContain('id');
    expect(names).not.toContain('comment');
  });

  it('keeps a scale measure whose stored type is not numeric', () => {
    expect(dependentColumns([{ name: 'satisfaction', type: 'string', measure: 'scale' }])).toEqual([
      'satisfaction',
    ]);
  });
});

describe('code frame open ends', () => {
  it('keeps text columns and drops numeric and already-coded ones', () => {
    expect(
      openEndColumns([
        { name: 'comments', type: 'string' },
        { name: 'Q7', type: 'numeric' },
        { name: 'agree_value', type: 'string', measure: 'ordinal' },
        { name: 'comments_codes', type: 'string' },
        { name: 'region', type: 'string', measure: 'nominal' },
      ])
    ).toEqual(['comments', 'region']);
  });
});
