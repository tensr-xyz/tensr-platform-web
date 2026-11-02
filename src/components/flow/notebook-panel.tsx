'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table } from '@/components/ui/table';
import { flowJson } from '@/lib/flow-api';

export type NotebookCell = {
  id: string;
  kind: 'code' | 'text';
  source: string;
  output: string;
  table?: Record<string, unknown>[] | null;
  running: boolean;
};

/** Earlier code cells run first with their output silenced, so names carry over within the session. */
export function sessionCode(cells: NotebookCell[], index: number): string {
  const earlier = cells
    .slice(0, index)
    .filter(cell => cell.kind === 'code' && cell.source.trim())
    .map(cell => cell.source);
  const current = cells[index]?.source || '';
  if (!earlier.length) return current;
  return [
    'import contextlib as _tensr_ctx, io as _tensr_io',
    'with _tensr_ctx.redirect_stdout(_tensr_io.StringIO()):',
    `    exec(${JSON.stringify(earlier.join('\n\n'))}, globals())`,
    current,
  ].join('\n');
}

export function notebookTable(output: unknown): Record<string, unknown>[] | null {
  if (!output || typeof output !== 'object') return null;
  const value = output as { type?: string; data?: unknown };
  if (value.type !== 'table' || !Array.isArray(value.data)) return null;
  return value.data.filter(row => row && typeof row === 'object') as Record<string, unknown>[];
}

let cellKey = 0;

export function blankCell(kind: NotebookCell['kind']): NotebookCell {
  cellKey += 1;
  return {
    id: `cell-${cellKey}`,
    kind,
    source: kind === 'code' ? 'df.head()' : '',
    output: '',
    running: false,
  };
}

export function notebookText(result: {
  stdout?: string | null;
  output?: unknown;
  error?: string | null;
}): string {
  if (typeof result.error === 'string' && result.error) return result.error;
  if (typeof result.stdout === 'string' && result.stdout) return result.stdout;
  if (typeof result.output === 'string') return result.output;
  if (result.output == null) return '';
  const typed = result.output as { type?: string; data?: unknown };
  if (typed && typed.type === 'text' && typeof typed.data === 'string') return typed.data;
  if (typed && typed.type === 'table') return '';
  try {
    return JSON.stringify(result.output, null, 2);
  } catch {
    return 'The notebook returned a value that could not be shown.';
  }
}

export function notebookPy(cells: NotebookCell[]): string {
  return cells
    .filter(cell => cell.kind === 'code' && cell.source.trim())
    .map(cell => cell.source.trim())
    .join('\n\n');
}

export function notebookIpynb(cells: NotebookCell[]): string {
  return JSON.stringify(
    {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: cells.map(cell => ({
        cell_type: cell.kind === 'text' ? 'markdown' : 'code',
        source: cell.source
          .split('\n')
          .map((line, index, all) => (index < all.length - 1 ? `${line}\n` : line)),
        metadata: {},
        ...(cell.kind === 'code' ? { outputs: [], execution_count: null } : {}),
      })),
    },
    null,
    2
  );
}

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function FlowNotebook({ datasetId, lead }: { datasetId?: string; lead?: ReactNode }) {
  const [cells, setCells] = useState<NotebookCell[]>(() => [blankCell('code')]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    setLoadedOnce(false);
  }, [datasetId]);

  const patch = (id: string, next: Partial<NotebookCell>) => {
    setCells(current => current.map(cell => (cell.id === id ? { ...cell, ...next } : cell)));
  };

  const run = (cell: NotebookCell, list: NotebookCell[] = cells): Promise<void> => {
    if (!datasetId || cell.kind !== 'code' || !cell.source.trim()) return Promise.resolve();
    const index = list.findIndex(item => item.id === cell.id);
    const firstLoad = !loadedOnce;
    patch(cell.id, {
      running: true,
      table: null,
      output: firstLoad ? 'Loading data…' : 'Running…',
    });
    return flowJson<{ stdout?: string | null; output?: unknown; error?: string | null }>(
      '/api/execute/python',
      {
        method: 'POST',
        body: JSON.stringify({
          code: sessionCode(list, index < 0 ? 0 : index),
          dataset_id: datasetId,
          save_as_dataset: false,
        }),
      }
    )
      .then(result => {
        setLoadedOnce(true);
        patch(cell.id, {
          running: false,
          output: notebookText(result) || (result.error ? '' : 'Ran · no output'),
          table: result.error ? null : notebookTable(result.output),
        });
      })
      .catch(err =>
        patch(cell.id, {
          running: false,
          output: err instanceof Error ? err.message : 'The notebook could not run.',
        })
      );
  };

  const runAll = async () => {
    for (const cell of cells.filter(item => item.kind === 'code')) {
      await run(cell, cells);
    }
  };

  return (
    <div className="notebook-page">
      <div className="notebook-bar">
        {lead}
        <Button className="notebook-run-all" type="button" onClick={() => void runAll()}>
          ▶ Run all
        </Button>
        <Button
          className="flow-btn"
          type="button"
          onClick={() => setCells(current => [...current, blankCell('code')])}
        >
          + Code
        </Button>
        <Button
          className="flow-btn"
          type="button"
          onClick={() => setCells(current => [...current, { ...blankCell('text'), source: '' }])}
        >
          + Text
        </Button>
        <span className="notebook-chip">No sheet filter · df is the open file</span>
        <span className="sheet-spacer" />
        <span className="notebook-kernel">
          <i /> Python · {cells.some(cell => cell.running) ? 'running' : 'idle'}
        </span>
        <Button
          className="flow-btn"
          type="button"
          onClick={() => download('notebook.py', notebookPy(cells), 'text/x-python')}
        >
          Export .py
        </Button>
        <Button
          className="flow-btn"
          type="button"
          onClick={() => download('notebook.ipynb', notebookIpynb(cells), 'application/json')}
        >
          .ipynb
        </Button>
      </div>
      <div className="notebook-scroll">
        <div className="notebook-head">
          <h2>Notebook</h2>
          <p>
            df is the open file. Cells share variables in this session: running a cell replays the
            cells above it first. A sheet filter is not applied.
          </p>
        </div>
        {cells.map((cell, index) => (
          <article key={cell.id} className="notebook-cell" data-kind={cell.kind}>
            <span className="notebook-gutter">[{index + 1}]</span>
            <div className="notebook-card" data-running={cell.running || undefined}>
              <Textarea
                value={cell.source}
                rows={Math.max(1, cell.source.split('\n').length)}
                aria-label={
                  cell.kind === 'code' ? `Code cell ${index + 1}` : `Text cell ${index + 1}`
                }
                placeholder={cell.kind === 'code' ? 'df.head()' : 'Write a note'}
                onChange={event => patch(cell.id, { source: event.target.value })}
                onKeyDown={event => {
                  if (cell.kind === 'code' && event.key === 'Enter' && event.shiftKey) {
                    event.preventDefault();
                    void run(cell);
                  }
                }}
              />
              {cell.kind === 'code' ? (
                <div className="notebook-out">
                  {cell.table && cell.table.length ? (
                    <div className="notebook-table">
                      <Table className="flow-table">
                        <thead>
                          <tr>
                            {Object.keys(cell.table[0]).map(key => (
                              <th key={key}>{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {cell.table.slice(0, 20).map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {Object.keys(cell.table![0]).map(key => (
                                <td key={key} data-num={typeof row[key] === 'number' || undefined}>
                                  {row[key] == null
                                    ? ''
                                    : typeof row[key] === 'number'
                                      ? Number((row[key] as number).toFixed(3)).toString()
                                      : String(row[key])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      <span className="flow-muted">
                        DataFrame · {cell.table.length} row{cell.table.length === 1 ? '' : 's'} ×{' '}
                        {Object.keys(cell.table[0]).length} cols
                      </span>
                    </div>
                  ) : cell.output ? (
                    <pre className="notebook-output">{cell.output}</pre>
                  ) : (
                    <span className="flow-muted">
                      {cell.running ? 'Running…' : 'Shift+Enter or Run to see the output'}
                    </span>
                  )}
                  <Button
                    className="notebook-run"
                    type="button"
                    disabled={cell.running}
                    onClick={() => void run(cell)}
                  >
                    {cell.running ? 'Running…' : 'Run'}
                  </Button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
