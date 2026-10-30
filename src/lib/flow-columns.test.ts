import { dependentColumns } from './flow-columns';

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
