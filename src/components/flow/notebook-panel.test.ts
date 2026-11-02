import { notebookIpynb, notebookPy, notebookText } from './notebook-panel';

describe('notebook panel', () => {
  const cells = [
    { id: '1', kind: 'code' as const, source: 'df.head()', output: '', running: false },
    { id: '2', kind: 'text' as const, source: 'A note', output: '', running: false },
  ];

  it('exports code cells as python and keeps text cells in the notebook file', () => {
    expect(notebookPy(cells)).toBe('df.head()');
    const parsed = JSON.parse(notebookIpynb(cells)) as { cells: { cell_type: string }[] };
    expect(parsed.cells.map(cell => cell.cell_type)).toEqual(['code', 'markdown']);
  });

  it('shows an executor error before stdout', () => {
    expect(notebookText({ error: 'Code execution failed', stdout: 'ok' })).toBe(
      'Code execution failed'
    );
  });
});
