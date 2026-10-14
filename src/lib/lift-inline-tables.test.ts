import { liftInlineTables } from './lift-inline-tables';

describe('liftInlineTables', () => {
  it('puts a table written inside a sentence on its own lines', () => {
    const fixed = liftInlineTables('The crosstab is | Q1 | West | | --- | --- | | Female | 50 |.');
    expect(fixed).toContain('\n| Q1 | West |');
    expect(fixed).toContain('\n| --- | --- |');
    expect(fixed).toContain('\n| Female | 50 |');
    expect(fixed.startsWith('The crosstab is')).toBe(true);
  });

  it('leaves a table that is already a block alone', () => {
    const block = '| Q1 | West |\n| --- | --- |\n| Female | 50 |';
    expect(liftInlineTables(block)).toBe(block);
  });
});
