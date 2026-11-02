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

describe('notebook session', () => {
  it('replays earlier code cells silently before the current one', () => {
    const { sessionCode } = jest.requireActual('./notebook-panel');
    const cells = [
      { id: 'a', kind: 'code', source: 'x = 41', output: '', running: false },
      { id: 'b', kind: 'text', source: 'note', output: '', running: false },
      { id: 'c', kind: 'code', source: 'x + 1', output: '', running: false },
    ];
    expect(sessionCode(cells, 0)).toBe('x = 41');
    const code = sessionCode(cells, 2);
    expect(code).toContain('redirect_stdout');
    expect(code).toContain('exec("x = 41", globals())');
    expect(code.endsWith('\nx + 1')).toBe(true);
  });

  it('reads a table output', () => {
    const { notebookTable, notebookText } = jest.requireActual('./notebook-panel');
    const output = { type: 'table', data: [{ a: 1 }] };
    expect(notebookTable(output)).toEqual([{ a: 1 }]);
    expect(notebookText({ output })).toBe('');
    expect(notebookText({ output: { type: 'text', data: '42' } })).toBe('42');
  });
});
