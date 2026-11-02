'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/rest';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { flowFetch, flowJson } from '@/lib/flow-api';
import {
  bannerColumns,
  bannerHeading,
  codedStub,
  efficiencyPercent,
  lettersFor,
  selectionFromCell,
  type BannerCell,
  type BannerColumn,
  type BannerRow,
  type SigLetter,
  type SurveyCell,
} from '@/lib/flow-survey';

type DatasetRow = {
  dataset_id?: string;
  id?: string;
  original_filename?: string;
  project_id?: string;
};

export function datasetRowId(row: DatasetRow): string {
  return row.dataset_id || row.id || '';
}

let currentCell: SurveyCell | null = null;
const cellListeners = new Set<(cell: SurveyCell | null) => void>();
let evidenceIds: string[] = [];
let evidenceFocus = 0;
const evidenceListeners = new Set<() => void>();

function publishEvidence() {
  evidenceListeners.forEach(listener => listener());
}

export function setEvidenceRespondents(ids: string[]) {
  evidenceIds = ids;
  publishEvidence();
}

export function focusEvidenceRows() {
  evidenceFocus += 1;
  publishEvidence();
}

export function useEvidenceSheet(): { ids: string[]; focus: number } {
  const [sheet, setSheet] = useState({ ids: evidenceIds, focus: evidenceFocus });
  useEffect(() => {
    const listener = () => setSheet({ ids: [...evidenceIds], focus: evidenceFocus });
    evidenceListeners.add(listener);
    return () => {
      evidenceListeners.delete(listener);
    };
  }, []);
  return sheet;
}

export function setSurveyCell(cell: SurveyCell | null) {
  currentCell = cell;
  if (!cell) setEvidenceRespondents([]);
  cellListeners.forEach(listener => listener(cell));
}

export function useSurveyCell(): SurveyCell | null {
  const [cell, setCell] = useState(currentCell);
  useEffect(() => {
    const listener = (next: SurveyCell | null) => setCell(next);
    cellListeners.add(listener);
    return () => {
      cellListeners.delete(listener);
    };
  }, []);
  return cell;
}

function columnNames(columns: { name?: string }[]): string[] {
  return columns.map(column => column.name || '').filter(Boolean);
}

function cellFigure(
  cell: BannerCell | undefined,
  figure: 'percent' | 'row_percent' | 'total_percent' | 'count' | 'mean',
  digits: number
): string {
  if (!cell) return '—';
  if (figure === 'count') {
    const count = cell.unweighted_n ?? cell.count;
    return count != null ? String(count) : '—';
  }
  if (figure === 'mean') return cell.mean != null ? cell.mean.toFixed(digits) : '—';
  const value =
    figure === 'row_percent'
      ? cell.row_percent
      : figure === 'total_percent'
        ? cell.total_percent
        : cell.percent;
  return value != null ? `${value.toFixed(digits)}%` : '—';
}

export function BannerGrid({
  book,
  onSelectCell,
  baseAtEnd = false,
  showQuotes = false,
  showNets = false,
  figure = 'percent',
  digits = 1,
  markLowBase = false,
}: {
  book: Record<string, unknown>;
  onSelectCell: (cell: SurveyCell) => void;
  baseAtEnd?: boolean;
  showQuotes?: boolean;
  showNets?: boolean;
  figure?: 'percent' | 'row_percent' | 'total_percent' | 'count' | 'mean';
  digits?: number;
  markLowBase?: boolean;
}) {
  const [picked, setPicked] = useState('');
  const columns = bannerColumns(book);
  const letters = (book.letters as SigLetter[]) || [];
  const rows = ((book.rows as BannerRow[]) || []).filter(row => showNets || row.kind !== 'net');
  const notCoded = ((book.stubs as { not_coded?: { unweighted_n?: number } }[]) || [])[0]
    ?.not_coded;
  if (!columns.length) return <p className="flow-muted">This table has no banner columns yet.</p>;
  const base = (
    <tr>
      <th>Base</th>
      {columns.map(column => {
        const sample = rows
          .flatMap(row => row.cells || [])
          .find(cell => cell.banner_id === column.id);
        return <td key={column.id}>{sample?.column_unweighted_n ?? '—'}</td>;
      })}
    </tr>
  );
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <Table className="flow-table">
          <thead>
            <tr>
              <th>{showQuotes ? 'Theme' : ''}</th>
              {columns.map(column => (
                <th key={column.id}>{bannerHeading(column)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {baseAtEnd ? null : base}
            {rows.map(row => {
              const quotes = (row.cells || []).find(
                cell => cell.banner_id === 'total'
              )?.unweighted_n;
              return (
                <tr key={row.id}>
                  <th>
                    {row.label}
                    {showQuotes && quotes != null ? (
                      <span className="flow-muted"> {quotes}</span>
                    ) : null}
                  </th>
                  {columns.map((column: BannerColumn) => {
                    const cell = (row.cells || []).find(item => item.banner_id === column.id);
                    const letter = lettersFor(letters, row.id, column.id);
                    return (
                      <td key={column.id}>
                        <Button
                          className="flow-cell"
                          type="button"
                          data-active={picked === `${row.id}:${column.id}`}
                          onClick={() => {
                            const selected = selectionFromCell(book, row, cell, letter);
                            if (!selected) return;
                            setPicked(`${row.id}:${column.id}`);
                            onSelectCell(selected);
                          }}
                        >
                          {cellFigure(cell, figure, digits)}
                          {markLowBase && cell?.low_base ? ' *' : ''}
                          {letter ? ` ${letter}` : ''}
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {baseAtEnd ? base : null}
          </tbody>
        </Table>
      </div>
      {book.answered_n != null && book.respondent_n != null ? (
        <p className="flow-muted">
          Base: answered {String(book.answered_n)} of {String(book.respondent_n)}
        </p>
      ) : null}
      {!showQuotes && notCoded?.unweighted_n != null ? (
        <p className="flow-muted">Not coded: {notCoded.unweighted_n}</p>
      ) : null}
    </div>
  );
}

export function ThemesPanel({
  datasetId,
  projectId,
  onSelectCell,
  onEditFrame,
}: {
  datasetId?: string;
  projectId?: string;
  onSelectCell: (cell: SurveyCell) => void;
  onEditFrame?: (column: string) => void;
}) {
  const [columns, setColumns] = useState<{ name: string; label: string }[]>([]);
  const [stub, setStub] = useState('');
  const [banner, setBanner] = useState('');
  const [weight, setWeight] = useState('');
  const [book, setBook] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [columnsReady, setColumnsReady] = useState(false);
  useEffect(() => {
    if (!datasetId) {
      setColumnsReady(true);
      return;
    }
    setColumnsReady(false);
    void flowJson<{ columns?: { name?: string; label?: string }[] }>(
      `/datasets/${datasetId}/metadata`
    )
      .then(meta => {
        setColumns(
          (meta.columns || [])
            .map(column => ({
              name: column.name || '',
              label: column.label || column.name || '',
            }))
            .filter(column => column.name)
        );
        setColumnsReady(true);
      })
      .catch(() => {
        setColumns([]);
        setError('Could not load columns.');
        setColumnsReady(true);
      });
  }, [datasetId]);
  const stubColumn = columns.find(column => column.name === stub);
  const themeCount = ((book?.rows as { kind?: string }[]) || []).filter(
    row => row.kind !== 'net'
  ).length;
  const notCoded = ((book?.stubs as { not_coded?: { unweighted_n?: number } }[]) || [])[0]
    ?.not_coded?.unweighted_n;
  const run = () => {
    if (!datasetId || !stub) return;
    setError('');
    setRunning(true);
    setBook(null);
    void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables`, {
      method: 'POST',
      body: JSON.stringify({
        stubs: [codedStub(stub)],
        banner: banner ? [{ column: banner }] : [],
        statistics: ['column_proportion'],
        significance_display: 'column_letters',
        weight: weight || 'none',
        save: false,
      }),
    })
      .then(page => {
        setBook(page);
        setRunning(false);
      })
      .catch(err => {
        setRunning(false);
        setError(err instanceof Error ? err.message : 'Themes did not run');
      });
  };
  return (
    <div className="themes">
      <div className="themes-tools">
        {book ? (
          <Button className="flow-btn" type="button" data-active onClick={() => setBook(null)}>
            {stubColumn?.label || stub} · {themeCount} theme{themeCount === 1 ? '' : 's'} ×
          </Button>
        ) : null}
        <Button
          className="flow-btn"
          type="button"
          disabled={!stub}
          onClick={() => onEditFrame?.(stub)}
        >
          Edit code frame
        </Button>
        <span className="sheet-spacer" />
        <ChoiceSelect
          className="flow-input"
          aria-label="Weight"
          value={weight}
          onValueChange={value => {
            setWeight(value);
            setBook(null);
          }}
          options={[
            { value: '', label: 'Unweighted' },
            ...columns.map(column => ({ value: column.name, label: column.label })),
          ]}
        />
      </div>
      <div className="themes-head">
        <div>
          <p className="flow-muted">Open end{stub ? ` · ${stub}` : ''}</p>
          <h2>{stubColumn?.label || 'Choose a theme column'}</h2>
          <p className="flow-muted">
            {book
              ? `${themeCount} theme${themeCount === 1 ? '' : 's'} · ${weight ? `weighted ${weight}` : 'unweighted'} · column %`
              : 'Column % with significance letters'}
          </p>
        </div>
        <div className="themes-split">
          <span className="flow-muted">Split by</span>
          {banner ? (
            <Button className="flow-btn" type="button" data-active onClick={() => setBanner('')}>
              {columns.find(column => column.name === banner)?.label || banner} ×
            </Button>
          ) : null}
          <ChoiceSelect
            className="flow-input"
            aria-label="Theme column"
            value={stub}
            onValueChange={value => {
              setStub(value);
              setBook(null);
            }}
            options={[
              { value: '', label: 'Theme column' },
              ...columns.map(column => ({ value: column.name, label: column.label })),
            ]}
          />
          <ChoiceSelect
            className="flow-input"
            aria-label="Banner"
            value={banner}
            onValueChange={value => {
              setBanner(value);
              setBook(null);
            }}
            options={[
              { value: '', label: '+' },
              ...columns.map(column => ({ value: column.name, label: column.label })),
            ]}
          />
          <Button
            className="flow-btn primary"
            type="button"
            disabled={!datasetId || !stub}
            onClick={run}
          >
            Run
          </Button>
        </div>
      </div>
      {!columnsReady ? (
        <div aria-busy="true">
          <Skeleton className="mb-2 h-8 w-full" />
          <Skeleton className="mb-2 h-8 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error ? (
        <p className="flow-error">{error}</p>
      ) : running ? (
        <div aria-busy="true">
          <Skeleton className="mb-2 h-8 w-full" />
          <Skeleton className="mb-2 h-8 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : book ? (
        <BannerGrid book={book} onSelectCell={onSelectCell} baseAtEnd showQuotes />
      ) : (
        <p className="flow-muted">Run a theme column to see the table.</p>
      )}
      {notCoded != null ? (
        <p className="themes-uncoded">
          {notCoded} not coded. These answers are not in the table until they have a theme.
        </p>
      ) : null}
      <div className="themes-links">
        {projectId ? (
          <Button className="flow-btn primary" type="button" asChild>
            <Link href={`/flow/p/${projectId}/report`}>Add to report</Link>
          </Button>
        ) : null}
        {projectId ? (
          <Button className="flow-btn" type="button" asChild>
            <Link href={`/flow/p/${projectId}/interviews`}>Open interviews</Link>
          </Button>
        ) : null}
        {projectId ? (
          <Button className="flow-btn" type="button" asChild>
            <Link href={`/flow/p/${projectId}/tables`}>Use as banner</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function EvidencePanel({
  datasetId,
  projectId,
}: {
  datasetId?: string;
  projectId?: string;
}) {
  const cell = useSurveyCell();
  const [quotes, setQuotes] = useState<Record<string, unknown> | null>(null);
  const [quotePhase, setQuotePhase] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [error, setError] = useState('');
  const [syntaxNote, setSyntaxNote] = useState('');
  useEffect(() => {
    setSyntaxNote('');
    if (!datasetId || !cell?.bitset || !cell.textColumn) {
      setQuotes(null);
      setQuotePhase('idle');
      setEvidenceRespondents([]);
      if (cell && !cell.bitset)
        setError('This cell has no respondent bitset, so the verbatims cannot be listed.');
      return;
    }
    setError('');
    setQuotes(null);
    setQuotePhase('loading');
    setEvidenceRespondents([]);
    const controller = new AbortController();
    void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/quotes`, {
      method: 'POST',
      body: JSON.stringify({
        text_column: cell.textColumn,
        row_uid_bitset: cell.bitset,
        page: 1,
        page_size: 20,
      }),
      signal: controller.signal,
    })
      .then(page => {
        setQuotes(page);
        setQuotePhase('ready');
        const rows = (page.quotes as { respondent_id?: string; row_uid?: string }[]) || [];
        setEvidenceRespondents(
          rows
            .flatMap(row => [row.row_uid, row.respondent_id])
            .map(value => String(value || ''))
            .filter(Boolean)
        );
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        setQuotes(null);
        setQuotePhase('idle');
        setError(err instanceof Error ? err.message : 'Could not load verbatims');
      });
    return () => controller.abort();
  }, [datasetId, cell]);
  if (!cell) {
    return (
      <div className="evidence">
        <p className="flow-muted">Select a cell in Themes or Tables to open its verbatims.</p>
      </div>
    );
  }
  const items = (quotes?.quotes as { respondent_id: string; text: string }[]) || [];
  const total = Number(quotes?.total || 0);
  const shown = items.length;
  return (
    <div className="evidence">
      <div className="evidence-lead">
        <p className="flow-muted">{cell.claim}</p>
        <p className="evidence-percent">
          {cell.percent || '—'}
          <span>{cell.textColumn}</span>
        </p>
        {cell.letter ? <Badge className="evidence-letter">Letter {cell.letter}</Badge> : null}
      </div>
      <div className="evidence-built">
        <p className="flow-muted">How it&apos;s built</p>
        <p>
          <span>Base, unweighted</span>
          <span>{cell.base || '—'}</span>
        </p>
        <p>
          <span>In this cell</span>
          <span>{cell.n || '—'}</span>
        </p>
        <p>
          <span>Weight</span>
          <span>{cell.weight || 'none'}</span>
        </p>
        <p>
          <span>Column</span>
          <span>{cell.textColumn || '—'}</span>
        </p>
      </div>
      {error ? <p className="flow-error">{error}</p> : null}
      <div className="evidence-said">
        {quotePhase === 'loading' ? (
          <div aria-busy="true">
            <Skeleton className="mb-2 h-4 w-40" />
            <Skeleton className="mb-2 h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <p className="flow-muted">
              <span>What they said · {cell.textColumn}</span>
              <span>{total}</span>
            </p>
            {items.map(item => (
              <article key={`${item.respondent_id}-${item.text}`}>
                <p>{item.text}</p>
                <p className="flow-muted">{item.respondent_id}</p>
              </article>
            ))}
            {total > shown ? (
              <p className="flow-muted">
                Showing {shown} of {total}
              </p>
            ) : null}
            <Button
              className="flow-btn evidence-see"
              type="button"
              onClick={() => focusEvidenceRows()}
            >
              See all {total} in the sheet
            </Button>
          </>
        )}
      </div>
      <div className="evidence-actions">
        {projectId ? (
          <Button className="flow-btn" type="button" asChild>
            <Link href={`/flow/p/${projectId}/tables`}>Open table</Link>
          </Button>
        ) : null}
        <Button
          className="flow-btn"
          type="button"
          onClick={() => setSyntaxNote('This cell has no stored syntax.')}
        >
          View syntax
        </Button>
        {projectId ? (
          <Button className="flow-btn primary" type="button" asChild>
            <Link href={`/flow/p/${projectId}/report`}>Cite in report</Link>
          </Button>
        ) : null}
      </div>
      {syntaxNote ? <p className="flow-muted">{syntaxNote}</p> : null}
    </div>
  );
}

type FrameCode = { id: string; label: string; keywords: string[] };

function codeIdFromLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return slug || 'code';
}

export function CodeFramePanel({
  datasetId,
  datasets,
  onAdopted,
}: {
  datasetId?: string;
  datasets: DatasetRow[];
  onAdopted?: (datasetId: string) => void;
}) {
  const [columns, setColumns] = useState<string[]>([]);
  const [textColumn, setTextColumn] = useState('');
  const [codes, setCodes] = useState<FrameCode[]>([]);
  const [progress, setProgress] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [rename, setRename] = useState('');
  const [sourceDataset, setSourceDataset] = useState('');
  const [schemaOnly, setSchemaOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [split, setSplit] = useState<{ id: string; left: string; right: string } | null>(null);

  useEffect(() => {
    void flowJson<{
      organizations?: { id?: string; privacy_mode?: string }[];
      active_organization_id?: string;
    }>('/api/organizations')
      .then(body => {
        const active = (body.organizations || []).find(
          org => org.id === body.active_organization_id
        );
        setSchemaOnly(active?.privacy_mode === 'schema_only');
      })
      .catch(() => setSchemaOnly(false));
  }, []);

  useEffect(() => {
    if (!datasetId) return;
    void flowJson<{ columns?: { name?: string }[] }>(`/datasets/${datasetId}/metadata`)
      .then(meta => setColumns(columnNames(meta.columns || [])))
      .catch(() => setColumns([]));
  }, [datasetId]);

  const codeColumn = String(progress?.code_column || (textColumn ? `${textColumn}_codes` : ''));
  const frameDataset = String(progress?.derived_dataset_id || datasetId || '');

  async function proposeCodes(useModel = false) {
    const request = () =>
      flowJson<{ codes?: FrameCode[] }>(`/datasets/${datasetId}/open-end/propose`, {
        method: 'POST',
        body: JSON.stringify({
          text_column: textColumn,
          use_model: useModel,
          confirm_verbatims_sent: useModel,
        }),
      });
    const read = (result: { codes?: FrameCode[] }) =>
      Array.isArray(result?.codes) ? result.codes : [];
    let next = read(await request());
    if (useModel && !next.length) next = read(await request());
    setCodes(next);
    return next;
  }

  async function applyCodes(useModel: boolean, frame: FrameCode[]) {
    let jobId: string | null = null;
    for (;;) {
      const applied: Record<string, unknown> = await flowJson(
        `/datasets/${datasetId}/open-end/apply`,
        {
          method: 'POST',
          body: JSON.stringify({
            text_column: textColumn,
            codes: frame,
            use_model: schemaOnly ? false : useModel,
            job_id: jobId,
          }),
        }
      );
      setProgress(applied);
      if (applied.done && applied.derived_dataset_id)
        onAdopted?.(String(applied.derived_dataset_id));
      if (applied.done || !applied.job_id) return;
      jobId = String(applied.job_id);
    }
  }

  async function editFrame(body: Record<string, unknown>) {
    await flowJson(`/datasets/${frameDataset}/open-end/frame`, {
      method: 'POST',
      body: JSON.stringify({ code_column: codeColumn, ...body }),
    });
  }

  return (
    <div className="flow-panel">
      <h2>Code frame</h2>
      <ChoiceSelect
        className="flow-input"
        aria-label="Open-end column"
        value={textColumn}
        onValueChange={setTextColumn}
        options={[
          { value: '', label: 'Open-end column' },
          ...columns.map(column => ({ value: column, label: column })),
        ]}
      />
      <div className="flow-row">
        <Button
          className="flow-btn"
          type="button"
          onClick={() => {
            setError('');
            proposeCodes().catch(err =>
              setError(err instanceof Error ? err.message : 'Propose failed')
            );
          }}
        >
          Propose
        </Button>
        <Button
          className="flow-btn"
          type="button"
          disabled={!textColumn}
          onClick={() => {
            setError('');
            const ready = codes.length ? Promise.resolve(codes) : proposeCodes();
            ready
              .then(next => {
                if (!next.length) {
                  setError('No themes were proposed for that column.');
                  return;
                }
                return applyCodes(false, next);
              })
              .catch(err => setError(err instanceof Error ? err.message : 'Keyword coding failed'));
          }}
        >
          Code with keywords
        </Button>
        {schemaOnly ? null : (
          <Button
            className="flow-btn primary"
            type="button"
            disabled={!textColumn}
            onClick={() => {
              setError('');
              proposeCodes(true)
                .then(next => {
                  if (!next.length) {
                    setError('Haiku did not propose any themes for that column.');
                    return;
                  }
                  return applyCodes(true, next);
                })
                .catch(err => setError(err instanceof Error ? err.message : 'Haiku coding failed'));
            }}
          >
            Code with Haiku
          </Button>
        )}
      </div>
      {schemaOnly ? (
        <p className="flow-muted">Schema-only studies code with keywords.</p>
      ) : (
        <p className="flow-muted">Haiku proposes themes from a sample, then codes every row.</p>
      )}
      {error ? <p className="flow-error">{error}</p> : null}
      <ul>
        {codes.map(code => (
          <li key={code.id} className="flow-row">
            <label>
              <Checkbox
                checked={selected.includes(code.id)}
                onCheckedChange={checked => {
                  setSelected(current =>
                    checked === true ? [...current, code.id] : current.filter(id => id !== code.id)
                  );
                }}
              />{' '}
              {code.label} <span className="flow-muted">{code.id}</span>
            </label>
            <Button
              className="flow-btn"
              type="button"
              onClick={() => setSplit({ id: code.id, left: '', right: '' })}
            >
              Split
            </Button>
          </li>
        ))}
      </ul>
      {selected.length > 1 ? (
        <Button
          className="flow-btn"
          type="button"
          onClick={() => {
            const [into, ...rest] = selected;
            setError('');
            rest
              .reduce(
                (chain, codeId) =>
                  chain.then(() => editFrame({ action: 'merge', code_id: codeId, into })),
                Promise.resolve()
              )
              .then(() => {
                setCodes(current =>
                  current.filter(code => code.id === into || !rest.includes(code.id))
                );
                setSelected([into]);
              })
              .catch(err => setError(err instanceof Error ? err.message : 'Merge failed'));
          }}
        >
          Merge
        </Button>
      ) : null}
      {split ? (
        <form
          className="flow-row"
          onSubmit={event => {
            event.preventDefault();
            const left = codeIdFromLabel(split.left);
            const right = codeIdFromLabel(split.right);
            setError('');
            editFrame({
              action: 'split',
              code_id: split.id,
              parts: [
                { id: left, label: split.left, keywords: [split.left.toLowerCase()] },
                { id: right, label: split.right, keywords: [split.right.toLowerCase()] },
              ],
            })
              .then(() => {
                setCodes(current =>
                  current.flatMap(code =>
                    code.id === split.id
                      ? [
                          { id: left, label: split.left, keywords: [split.left.toLowerCase()] },
                          { id: right, label: split.right, keywords: [split.right.toLowerCase()] },
                        ]
                      : [code]
                  )
                );
                setSplit(null);
              })
              .catch(err => setError(err instanceof Error ? err.message : 'Split failed'));
          }}
        >
          <Input
            className="flow-input"
            placeholder="First theme"
            value={split.left}
            onChange={event => setSplit({ ...split, left: event.target.value })}
          />
          <Input
            className="flow-input"
            placeholder="Second theme"
            value={split.right}
            onChange={event => setSplit({ ...split, right: event.target.value })}
          />
          <Button className="flow-btn" type="submit">
            Split {split.id}
          </Button>
        </form>
      ) : null}
      {progress ? (
        <p>
          {progress.error
            ? String(progress.error)
            : progress.done
              ? `Coded ${String(progress.processed)} of ${String(progress.total)} comments.${
                  Number(progress.review_count || 0)
                    ? ` ${String(progress.review_count)} need a look.`
                    : ''
                }`
              : `Coding comments: ${String(progress.processed)} of ${String(progress.total)}.`}
        </p>
      ) : null}
      {selected.length === 1 ? (
        <form
          className="flow-row"
          onSubmit={event => {
            event.preventDefault();
            const codeId = selected[0];
            setError('');
            editFrame({ action: 'rename', code_id: codeId, label: rename })
              .then(() => {
                setCodes(current =>
                  current.map(code => (code.id === codeId ? { ...code, label: rename } : code))
                );
              })
              .catch(err => setError(err instanceof Error ? err.message : 'Rename failed'));
          }}
        >
          <Input
            className="flow-input"
            aria-label="New theme label"
            placeholder="New label"
            value={rename}
            onChange={event => setRename(event.target.value)}
          />
          <Button className="flow-btn" type="submit">
            Rename
          </Button>
        </form>
      ) : null}
      <form
        className="flow-row"
        onSubmit={event => {
          event.preventDefault();
          if (!sourceDataset || !datasetId) return;
          setError('');
          void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/open-end/reapply`, {
            method: 'POST',
            body: JSON.stringify({
              text_column: textColumn,
              source_dataset_id: sourceDataset,
              code_column: `${textColumn}_codes`,
              use_model: false,
              candidate_dataset_ids: datasets.map(dataset => datasetRowId(dataset)).filter(Boolean),
            }),
          })
            .then(result => {
              setProgress(result);
              if (result.derived_dataset_id) onAdopted?.(String(result.derived_dataset_id));
            })
            .catch(err => {
              const raw = err instanceof Error ? err.message : 'Reapply failed';
              try {
                const body = JSON.parse(raw) as {
                  detail?: { message?: string; frames?: { dataset_id: string }[] };
                };
                const frames = body.detail?.frames || [];
                if (frames[0]?.dataset_id) setSourceDataset(frames[0].dataset_id);
                setError(
                  body.detail?.message ||
                    'That file has no saved code frame. Pick the dataset in this project that has one.'
                );
              } catch {
                setError(raw);
              }
            });
        }}
      >
        <ChoiceSelect
          className="flow-input"
          aria-label="Reapply dataset"
          value={sourceDataset}
          onValueChange={setSourceDataset}
          options={[
            { value: '', label: 'Dataset in this project' },
            ...datasets
              .filter(dataset => datasetRowId(dataset) && datasetRowId(dataset) !== datasetId)
              .map(dataset => ({
                value: datasetRowId(dataset),
                label: dataset.original_filename || datasetRowId(dataset),
              })),
          ]}
        />
        <Button className="flow-btn" type="submit" disabled={!sourceDataset || !textColumn}>
          Reapply
        </Button>
      </form>
    </div>
  );
}

type WeightTarget = { column: string; code: string; percent: string };

export function WeightPanel({
  datasetId,
  datasets,
  onClose,
  onAdopted,
}: {
  datasetId?: string;
  datasets: DatasetRow[];
  onClose: () => void;
  onAdopted?: (datasetId: string) => void;
}) {
  const [columns, setColumns] = useState<string[]>([]);
  const [targets, setTargets] = useState<WeightTarget[]>([{ column: '', code: '', percent: '50' }]);
  const [sourceDataset, setSourceDataset] = useState('');
  const [codeOptions, setCodeOptions] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!datasetId) return;
    void flowJson<{ columns?: { name?: string }[] }>(`/datasets/${datasetId}/metadata`)
      .then(meta => {
        const names = columnNames(meta.columns || []);
        setColumns(names);
        setTargets(current =>
          current.map((row, index) =>
            index === 0 && !row.column ? { ...row, column: names[0] || '' } : row
          )
        );
      })
      .catch(() => setColumns([]));
  }, [datasetId]);

  useEffect(() => {
    if (!datasetId) return;
    const needed = [...new Set(targets.map(row => row.column).filter(Boolean))];
    for (const column of needed) {
      if (codeOptions[column]) continue;
      void flowJson<{ frequencies?: { value: string }[] }>(
        `/datasets/${datasetId}/explore/column_frequencies`,
        { method: 'POST', body: JSON.stringify({ column }) }
      )
        .then(body => {
          const values = (body.frequencies || []).map(row => String(row.value));
          setCodeOptions(current => ({ ...current, [column]: values }));
        })
        .catch(() => setCodeOptions(current => ({ ...current, [column]: [] })));
    }
  }, [datasetId, targets, codeOptions]);

  function updateTarget(index: number, patch: Partial<WeightTarget>) {
    setTargets(current => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flow-palette" onClick={onClose}>
      <div onClick={event => event.stopPropagation()}>
        <h2>Weighting</h2>
        <p className="flow-muted">
          Rake each code to a target share. Load those shares from another dataset.
        </p>
        <ul>
          {targets.map((row, index) => (
            <li key={index} className="flow-row">
              <ChoiceSelect
                className="flow-input"
                aria-label={`Target column ${index + 1}`}
                value={row.column}
                onValueChange={value => updateTarget(index, { column: value, code: '' })}
                options={columns.map(item => ({ value: item, label: item }))}
              />
              <ChoiceSelect
                className="flow-input"
                aria-label={`Target code ${index + 1}`}
                value={row.code}
                onValueChange={value => updateTarget(index, { code: value })}
                options={[
                  { value: '', label: 'Code' },
                  ...(codeOptions[row.column] || []).map(code => ({ value: code, label: code })),
                ]}
              />
              <Input
                className="flow-input"
                aria-label={`Target percent ${index + 1}`}
                value={row.percent}
                onChange={event => updateTarget(index, { percent: event.target.value })}
              />
              <Button
                className="flow-btn"
                type="button"
                onClick={() => setTargets(current => current.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <Button
          className="flow-btn"
          type="button"
          onClick={() =>
            setTargets(current => [...current, { column: columns[0] || '', code: '', percent: '' }])
          }
        >
          Add target
        </Button>
        <ChoiceSelect
          className="flow-input"
          aria-label="Load targets from"
          value={sourceDataset}
          onValueChange={setSourceDataset}
          options={[
            { value: '', label: 'Dataset in this project' },
            ...datasets
              .filter(dataset => datasetRowId(dataset) && datasetRowId(dataset) !== datasetId)
              .map(dataset => ({
                value: datasetRowId(dataset),
                label: dataset.original_filename || datasetRowId(dataset),
              })),
          ]}
        />
        {error ? <p className="flow-error">{error}</p> : null}
        {result ? (
          <p>
            Efficiency{' '}
            {efficiencyPercent(
              (result.diagnostics as { weighting_efficiency?: number } | undefined)
                ?.weighting_efficiency
            ) || '—'}
          </p>
        ) : null}
        <div className="flow-row">
          <Button
            className="flow-btn"
            type="button"
            onClick={() => {
              if (!sourceDataset) return;
              const columnsToLoad = [...new Set(targets.map(row => row.column).filter(Boolean))];
              setError('');
              void Promise.all(
                columnsToLoad.map(column =>
                  flowJson<{ frequencies?: { value: string; percentage: number }[] }>(
                    `/datasets/${sourceDataset}/explore/column_frequencies`,
                    { method: 'POST', body: JSON.stringify({ column }) }
                  ).then(body => ({ column, body }))
                )
              )
                .then(loaded => {
                  const next: WeightTarget[] = [];
                  for (const item of loaded) {
                    for (const frequency of item.body.frequencies || []) {
                      next.push({
                        column: item.column,
                        code: String(frequency.value),
                        percent: String(Math.round(frequency.percentage * 1000) / 10),
                      });
                    }
                  }
                  if (next.length) setTargets(next);
                })
                .catch(err =>
                  setError(err instanceof Error ? err.message : 'Could not load targets')
                );
            }}
          >
            Load targets
          </Button>
          <Button
            className="flow-btn primary"
            type="button"
            disabled={!datasetId}
            onClick={() => {
              if (!datasetId) return;
              const categorical: Record<string, Record<string, number>> = {};
              for (const row of targets) {
                if (!row.column || !row.code) continue;
                categorical[row.column] = categorical[row.column] || {};
                categorical[row.column][row.code] = Number(row.percent) / 100;
              }
              setError('');
              void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/weights/rake`, {
                method: 'POST',
                body: JSON.stringify({ categorical_targets: categorical }),
              })
                .then(payload => {
                  setResult(payload);
                  const nextId = String(payload.derived_dataset_id || payload.dataset_id || '');
                  if (nextId) onAdopted?.(nextId);
                })
                .catch(err => setError(err instanceof Error ? err.message : 'Rake did not run'));
            }}
          >
            Rake
          </Button>
          <Button className="flow-btn" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

type TableColumn = { name: string; label: string; labels: Record<string, string> };
type SavedSpec = { spec_id?: string; id?: string; label?: string; name?: string };
type SavedBook = { id?: string; name?: string; n_specs?: number };

function scaleCodes(labels: Record<string, string> | undefined, end: 'top' | 'bottom'): string[] {
  const scored = Object.keys(labels || {})
    .map(code => ({ code, n: Number(code) }))
    .filter(item => Number.isFinite(item.n))
    .sort((a, b) => a.n - b.n);
  const picked = end === 'bottom' ? scored.slice(0, 2) : scored.slice(-2);
  return picked.map(item => item.code);
}

function bannerNames(spec: { banners?: { column?: string; columns?: string[] }[] } | undefined) {
  const names: string[] = [];
  for (const banner of spec?.banners || []) {
    if (banner.column) names.push(String(banner.column));
    for (const column of banner.columns || []) names.push(String(column));
  }
  return names.filter((name, index) => name && names.indexOf(name) === index);
}

export function TablesBuilder({
  datasetId,
  projectId,
}: {
  datasetId?: string;
  projectId?: string;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [weightColumn, setWeightColumn] = useState('');
  const [specs, setSpecs] = useState<SavedSpec[]>([]);
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [stub, setStub] = useState('');
  const [banners, setBanners] = useState<string[]>([]);
  const [weight, setWeight] = useState('');
  const [statistic, setStatistic] = useState('column_proportion');
  const [digits, setDigits] = useState(0);
  const [lettersOn, setLettersOn] = useState(true);
  const [nest, setNest] = useState(false);
  const [lowBase, setLowBase] = useState(true);
  const [top2, setTop2] = useState(false);
  const [bottom2, setBottom2] = useState(false);
  const [meanOn, setMeanOn] = useState(false);
  const [book, setBook] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState('');
  const [thread, setThread] = useState<{ role: 'user' | 'run'; text: string }[]>([]);
  const [railReady, setRailReady] = useState(false);

  useEffect(() => {
    if (!datasetId) {
      setRailReady(true);
      return;
    }
    setRailReady(false);
    let live = true;
    void Promise.all([
      flowJson<{ specs?: SavedSpec[] }>(`/datasets/${datasetId}/tables`).catch(() => ({
        specs: [] as SavedSpec[],
      })),
      flowJson<{ books?: SavedBook[] }>(`/datasets/${datasetId}/banner-books`).catch(() => ({
        books: [] as SavedBook[],
      })),
    ]).then(([specPage, bookPage]) => {
      if (!live) return;
      setSpecs(specPage.specs || []);
      setBooks(bookPage.books || []);
      setRailReady(true);
    });
    void flowJson<{
      columns?: { name?: string; label?: string; value_labels?: Record<string, string> }[];
      active_weight_column?: string | null;
    }>(`/datasets/${datasetId}/metadata`)
      .then(meta => {
        setWeightColumn(meta.active_weight_column || '');
        setColumns(
          (meta.columns || [])
            .map(column => ({
              name: column.name || '',
              label: column.label || column.name || '',
              labels: column.value_labels || {},
            }))
            .filter(column => column.name)
        );
      })
      .catch(() => setColumns([]));
    return () => {
      live = false;
    };
  }, [datasetId]);

  const labelFor = (name: string) => columns.find(column => column.name === name)?.label || name;
  const figure = meanOn
    ? 'mean'
    : statistic === 'count'
      ? 'count'
      : statistic === 'row_proportion'
        ? 'row_percent'
        : statistic === 'total_proportion'
          ? 'total_percent'
          : 'percent';

  function openCell(cell: SurveyCell) {
    setSurveyCell(cell);
    if (projectId) router.push(`/flow/p/${projectId}/responses`);
  }

  function remember(body: Record<string, unknown>) {
    setBook(body);
    const spec = body.spec as
      | {
          id?: string;
          label?: string;
          stubs?: { column?: string }[];
          banners?: { column?: string; columns?: string[] }[];
        }
      | undefined;
    const stubColumn = spec?.stubs?.[0]?.column;
    if (stubColumn) setStub(String(stubColumn));
    const names = bannerNames(spec);
    if (names.length) setBanners(names);
    const id = String(spec?.id || '');
    if (id) {
      setSpecs(current =>
        current.some(item => (item.spec_id || item.id) === id)
          ? current
          : [{ spec_id: id, label: spec?.label || stubColumn || stub }, ...current]
      );
    }
  }

  function saveTable() {
    if (!datasetId || !stub) return;
    const column = columns.find(item => item.name === stub);
    const nets: { label: string; values: string[] }[] = [];
    if (top2) {
      const values = scaleCodes(column?.labels, 'top');
      if (values.length < 2) {
        setError('That column has no numbered scale for a top 2 box.');
        return;
      }
      nets.push({ label: 'Top 2 box', values });
    }
    if (bottom2) {
      const values = scaleCodes(column?.labels, 'bottom');
      if (values.length < 2) {
        setError('That column has no numbered scale for a bottom 2 box.');
        return;
      }
      nets.push({ label: 'Bottom 2 box', values });
    }
    setError('');
    const statistics = meanOn ? [statistic, 'column_mean'] : [statistic];
    void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables`, {
      method: 'POST',
      body: JSON.stringify({
        stubs: [{ ...codedStub(stub), ...(nets.length ? { nets } : {}) }],
        banner: banners.map(columnName => ({ column: columnName })),
        statistics,
        significance_display: lettersOn ? 'column_letters' : 'none',
        nest_banners: nest,
        low_base_threshold: lowBase ? 30 : 0,
        suppress_low_base: false,
        decimals: { [statistic]: digits, ...(meanOn ? { column_mean: digits } : {}) },
        weight: weight || 'none',
        save: true,
      }),
    })
      .then(body => {
        remember(body);
        const across = banners.length ? banners.map(labelFor).join(', ') : 'the total';
        setThread(current => [
          ...current,
          {
            role: 'run',
            text: `Built ${labelFor(stub)} × ${across}`,
          },
          {
            role: 'run',
            text: `${weight ? `Weighted by ${labelFor(weight)}` : 'Unweighted'}, ${
              lettersOn ? 'sig at 95%' : 'no significance letters'
            }`,
          },
        ]);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not save the table'));
  }

  function currentSpec(): Record<string, unknown> | null {
    const spec = book?.spec;
    return spec && typeof spec === 'object' ? (spec as Record<string, unknown>) : null;
  }

  function addToBook() {
    const spec = currentSpec();
    if (!datasetId || !spec) {
      setError('Save a table before adding it to a banner book.');
      return;
    }
    setError('');
    void flowJson<{ book?: SavedBook }>(`/datasets/${datasetId}/banner-books`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Banner book', specs: [spec] }),
    })
      .then(saved => {
        if (saved.book?.id) setBooks(current => [saved.book as SavedBook, ...current]);
        setNote('Added to a banner book.');
      })
      .catch(err =>
        setError(err instanceof Error ? err.message : 'Could not save the banner book')
      );
  }

  function runBook() {
    const spec = currentSpec();
    if (!datasetId || !spec) {
      setError('Save a table before running a banner book.');
      return;
    }
    setError('');
    void flowJson<{ book?: { id?: string } }>(`/datasets/${datasetId}/banner-books`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Banner book', specs: [spec] }),
    })
      .then(saved => {
        const bookId = saved.book?.id;
        if (!bookId) throw new Error('The banner book was not saved.');
        if (saved.book) setBooks(current => [saved.book as SavedBook, ...current]);
        return flowJson<{ tables?: unknown[] }>(
          `/datasets/${datasetId}/banner-books/${bookId}/run`,
          {
            method: 'POST',
            body: JSON.stringify({ target_dataset_id: datasetId, mapping: {} }),
          }
        );
      })
      .then(result => {
        const count = result?.tables?.length ?? 0;
        setNote(`Banner book ran on this file. ${count} table${count === 1 ? '' : 's'}.`);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The banner book did not run'));
  }

  const specId = String((book?.spec as { id?: string } | undefined)?.id || '');
  const selectedIndex = specs.findIndex(item => (item.spec_id || item.id) === specId);
  const title = book
    ? `${selectedIndex >= 0 ? `T${selectedIndex + 1} · ` : ''}${labelFor(stub)}${
        banners.length ? ` by ${banners.map(labelFor).join(', ')}` : ''
      }`
    : 'Save a table';
  const baseLine =
    book?.answered_n != null && book?.respondent_n != null
      ? `Base: answered ${String(book.answered_n)} of ${String(book.respondent_n)}`
      : '';
  const totalBase = (() => {
    if (book?.respondent_n != null) return String(book.respondent_n);
    const rows = (book?.rows as BannerRow[]) || [];
    for (const row of rows) {
      const cell = (row.cells || []).find(item => item.banner_id === 'total');
      if (cell?.column_unweighted_n != null) return String(cell.column_unweighted_n);
    }
    return '';
  })();

  return (
    <div className="flow-split tables-board">
      <aside className="tables-rail">
        <div className="tables-rail-head">
          <span>Tables</span>
          <span>{specs.length}</span>
        </div>
        {!railReady ? (
          <div aria-busy="true">
            <Skeleton className="mb-2 h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : specs.length ? (
          specs.map((spec, index) => {
            const id = spec.spec_id || spec.id || '';
            return (
              <Button
                key={id}
                className="tables-saved"
                type="button"
                data-active={id === specId}
                onClick={() => {
                  void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables/${id}`)
                    .then(remember)
                    .catch(err =>
                      setError(err instanceof Error ? err.message : 'Could not open that table')
                    );
                }}
              >
                <span>T{index + 1}</span>
                <span>{spec.label || spec.name || id}</span>
              </Button>
            );
          })
        ) : (
          <p className="flow-muted">No saved tables yet</p>
        )}
        <div className="tables-rail-head">
          <span>Banner books</span>
          <Button
            className="flow-btn"
            type="button"
            onClick={addToBook}
            aria-label="Add to banner book"
          >
            +
          </Button>
        </div>
        {!railReady ? null : books.length ? (
          books.map(item => (
            <p key={item.id} className="tables-book">
              {item.name || 'Banner book'}
              {item.n_specs != null ? ` · ${item.n_specs}` : ''}
            </p>
          ))
        ) : (
          <p className="flow-muted">No banner books yet</p>
        )}
      </aside>
      <section className="tables-main">
        <div className="tables-tools">
          <div className="tables-line">
            <span>Stub</span>
            {stub ? (
              <Button className="tables-chip accent" type="button" onClick={() => setStub('')}>
                {labelFor(stub)} ×
              </Button>
            ) : null}
            <ChoiceSelect
              className="flow-input"
              aria-label="Table stub"
              value=""
              onValueChange={value => {
                if (value) setStub(value);
              }}
              options={[
                { value: '', label: '+ Drop variable' },
                ...columns.map(column => ({ value: column.name, label: column.label })),
              ]}
            />
          </div>
          <div className="tables-line">
            <span>Banner</span>
            {banners.map(name => (
              <Button
                key={name}
                className="tables-chip"
                type="button"
                onClick={() => setBanners(current => current.filter(item => item !== name))}
              >
                {labelFor(name)} ×
              </Button>
            ))}
            <ChoiceSelect
              className="flow-input"
              aria-label="Add banner"
              value=""
              onValueChange={value => {
                if (!value || value === stub || banners.includes(value)) return;
                setBanners(current => [...current, value]);
              }}
              options={[
                { value: '', label: '+' },
                ...columns
                  .filter(column => column.name !== stub && !banners.includes(column.name))
                  .map(column => ({ value: column.name, label: column.label })),
              ]}
            />
          </div>
          <div className="tables-line wrap">
            <span>Show</span>
            <div className="tables-segment">
              {(
                [
                  ['count', 'Counts'],
                  ['column_proportion', 'Column %'],
                  ['row_proportion', 'Row %'],
                  ['total_proportion', 'Total %'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  className="flow-btn"
                  type="button"
                  data-active={statistic === value && !meanOn}
                  onClick={() => {
                    setStatistic(value);
                    setMeanOn(false);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Button
              className="flow-btn"
              type="button"
              onClick={() => setDigits(current => (current + 1) % 3)}
            >
              {digits} dp
            </Button>
            <Button
              className="flow-btn"
              type="button"
              data-active={lettersOn}
              onClick={() => setLettersOn(current => !current)}
            >
              Sig 95% · A/a letters
            </Button>
            <Button
              className="flow-btn"
              type="button"
              data-active={nest}
              onClick={() => setNest(current => !current)}
            >
              Nest banners
            </Button>
            <Button
              className="flow-btn"
              type="button"
              data-active={lowBase}
              onClick={() => setLowBase(current => !current)}
            >
              Low base &lt; 30 *
            </Button>
            <ChoiceSelect
              className="flow-input"
              aria-label="Table weight"
              value={weight}
              onValueChange={setWeight}
              options={[
                { value: '', label: 'Unweighted' },
                ...(weightColumn ? [{ value: weightColumn, label: `Weight ${weightColumn}` }] : []),
              ]}
            />
            <span className="flow-muted">Scale</span>
            <div className="tables-segment">
              <Button
                className="flow-btn"
                type="button"
                data-active={top2}
                onClick={() => setTop2(current => !current)}
              >
                Top 2 box
              </Button>
              <Button
                className="flow-btn"
                type="button"
                data-active={bottom2}
                onClick={() => setBottom2(current => !current)}
              >
                Bottom 2 box
              </Button>
              <Button
                className="flow-btn"
                type="button"
                data-active={meanOn}
                onClick={() => setMeanOn(current => !current)}
              >
                Mean
              </Button>
            </div>
            <span className="flow-muted">Nets kept on re-run</span>
            <Button className="flow-btn" type="button" onClick={runBook}>
              Run as banner book
            </Button>
            <Button className="flow-btn primary" type="button" disabled={!stub} onClick={saveTable}>
              Save table
            </Button>
          </div>
        </div>
        {error ? <p className="flow-error">{error}</p> : null}
        {note ? <p className="flow-muted">{note}</p> : null}
        <div className="tables-sheet">
          <div className="tables-title">
            <div>
              <h2>{title}</h2>
              <p className="flow-muted">{[labelFor(stub), baseLine].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="tables-title-actions">
              <Button
                className="flow-btn"
                type="button"
                onClick={() => setNote('The chart for this table is the next screen.')}
              >
                Chart
              </Button>
              <Button className="flow-btn" type="button" onClick={addToBook}>
                Add to book
              </Button>
              <Button
                className="flow-btn"
                type="button"
                onClick={() => {
                  if (!datasetId || !specId) {
                    setError('Save the table before exporting.');
                    return;
                  }
                  void downloadExport(
                    `/datasets/${datasetId}/tables/${specId}/export.docx`,
                    'table.docx'
                  ).catch(err =>
                    setError(err instanceof Error ? err.message : 'Could not export the table')
                  );
                }}
              >
                Export
              </Button>
            </div>
          </div>
          {book ? (
            <BannerGrid
              book={book}
              onSelectCell={openCell}
              baseAtEnd
              showNets={
                top2 ||
                bottom2 ||
                ((book.rows as { kind?: string }[]) || []).some(row => row.kind === 'net')
              }
              figure={figure}
              digits={digits}
              markLowBase={lowBase}
            />
          ) : (
            <p className="flow-muted">Choose a stub and save the table.</p>
          )}
        </div>
        <div className="tables-foot">
          <span>{totalBase ? `${totalBase} respondents` : ''}</span>
          <span>{weight ? 'Weighted' : book ? 'Unweighted' : ''}</span>
          <span>{specId ? 'Saved' : ''}</span>
        </div>
      </section>
      <aside className="tables-agent">
        <div className="tables-agent-head">
          <span className="tables-dot" />
          <span>{book ? labelFor(stub) : 'Table'}</span>
        </div>
        <div className="tables-thread">
          {thread.map((item, index) => (
            <p
              key={`${item.role}-${index}`}
              className={item.role === 'user' ? 'tables-ask' : 'flow-muted'}
            >
              {item.role === 'run' ? `✓ ${item.text}` : item.text}
            </p>
          ))}
          {projectId ? (
            <Button className="flow-btn" type="button" asChild>
              <Link href={`/flow/p/${projectId}/chat`}>Open chat</Link>
            </Button>
          ) : null}
        </div>
        <form
          className="tables-composer"
          onSubmit={event => {
            event.preventDefault();
            const text = ask.trim();
            if (!text) return;
            setThread(current => [...current, { role: 'user', text }]);
            setAsk('');
          }}
        >
          <Input
            value={ask}
            onChange={event => setAsk(event.target.value)}
            placeholder="Ask, or tell it to change the table…"
            aria-label="Ask about this table"
          />
          <Button className="flow-btn primary" type="submit">
            Ask
          </Button>
        </form>
      </aside>
    </div>
  );
}

export async function downloadExport(path: string, filename: string, init?: RequestInit) {
  const response = await flowFetch(path, init);
  if (!response.ok) throw new Error(await response.text());
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      const comma = value.indexOf(',');
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
