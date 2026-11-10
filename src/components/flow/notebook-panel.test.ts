import { blankCell, notebookSource } from './notebook-panel';

describe('notebook languages', () => {
  it('starts an R cell empty and runs it without the Python replay wrapper', () => {
    expect(blankCell('code', 'python').source).toBe('df.head()');
    expect(blankCell('code', 'r').source).toBe('');
    const cell = { ...blankCell('code', 'r'), source: 'head(df)' };
    expect(notebookSource([cell], 0, 'r')).toBe('head(df)');
    expect(notebookSource([cell], 0, 'r')).not.toContain('exec');
  });
});
