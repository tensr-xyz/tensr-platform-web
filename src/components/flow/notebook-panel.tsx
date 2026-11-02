'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { flowJson } from '@/lib/flow-api';

export type NotebookCell = {
  id: string;
  kind: 'code' | 'text';
  source: string;
  output: string;
  running: boolean;
};

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

  const run = (cell: NotebookCell) => {
    if (!datasetId || cell.kind !== 'code' || !cell.source.trim()) return;
    const firstLoad = !loadedOnce;
    patch(cell.id, {
      running: true,
      output: firstLoad ? 'Loading data…' : 'Running…',
    });
    void flowJson<{ stdout?: string | null; output?: unknown; error?: string | null }>(
      '/api/execute/python',
      {
        method: 'POST',
        body: JSON.stringify({ code: cell.source, dataset_id: datasetId, save_as_dataset: false }),
      }
    )
      .then(result => {
        setLoadedOnce(true);
        patch(cell.id, { running: false, output: notebookText(result) });
      })
      .catch(err =>
        patch(cell.id, {
          running: false,
          output: err instanceof Error ? err.message : 'The notebook could not run.',
        })
      );
  };

  const runAll = () => {
    cells.filter(cell => cell.kind === 'code').forEach(run);
  };

  return (
    <div className="notebook-page">
      <div className="notebook-bar">
        {lead}
        <Button className="notebook-run-all" type="button" onClick={runAll}>
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
            df is the open file. Each cell runs on its own, so cells do not share variables, and a
            sheet filter is not applied.
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
                    run(cell);
                  }
                }}
              />
              {cell.kind === 'code' ? (
                <div className="notebook-out">
                  {cell.output ? (
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
                    onClick={() => run(cell)}
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
