import { liftInlineTables } from './lift-inline-tables';

describe('liftInlineTables', () => {
  it('puts a table written inside a sentence on its own lines', () => {
    const fixed = liftInlineTables('The crosstab is | Q1 | West | | --- | --- | | Female | 50 |.');
    expect(fixed).toBe('The crosstab is\n\n| Q1 | West |\n| --- | --- |\n| Female | 50 |\n\n.');
  });

  it('leaves a table that is already a block alone', () => {
    const block = '| Q1 | West |\n| --- | --- |\n| Female | 50 |';
    expect(liftInlineTables(block)).toBe(block);
  });
});
