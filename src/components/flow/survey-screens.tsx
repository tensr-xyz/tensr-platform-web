'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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

export function setSurveyCell(cell: SurveyCell | null) {
  currentCell = cell;
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

export function BannerGrid({
  book,
  onSelectCell,
}: {
  book: Record<string, unknown>;
  onSelectCell: (cell: SurveyCell) => void;
}) {
  const columns = bannerColumns(book);
  const letters = (book.letters as SigLetter[]) || [];
  const rows = ((book.rows as BannerRow[]) || []).filter(row => row.kind !== 'net');
  const notCoded = ((book.stubs as { not_coded?: { unweighted_n?: number } }[]) || [])[0]
    ?.not_coded;
  if (!columns.length) return <p className="flow-muted">This table has no banner columns yet.</p>;
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <Table className="flow-table">
          <thead>
            <tr>
              <th />
              {columns.map(column => (
                <th key={column.id}>{bannerHeading(column)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Base</th>
              {columns.map(column => {
                const sample = rows
                  .flatMap(row => row.cells || [])
                  .find(cell => cell.banner_id === column.id);
                return <td key={column.id}>{sample?.column_unweighted_n ?? '—'}</td>;
              })}
            </tr>
            {rows.map(row => (
              <tr key={row.id}>
                <th>{row.label}</th>
                {columns.map((column: BannerColumn) => {
                  const cell = (row.cells || []).find(item => item.banner_id === column.id);
                  const letter = lettersFor(letters, row.id, column.id);
                  return (
                    <td key={column.id}>
                      <Button
                        className="flow-cell"
                        type="button"
                        onClick={() => {
                          const selected = selectionFromCell(book, row, cell);
                          if (selected) onSelectCell(selected);
                        }}
                      >
                        {cell?.percent != null ? `${cell.percent.toFixed(1)}%` : '—'}
                        {letter ? ` ${letter}` : ''}
                      </Button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {book.answered_n != null && book.respondent_n != null ? (
        <p className="flow-muted">
          Base: answered {String(book.answered_n)} of {String(book.respondent_n)}
        </p>
      ) : null}
      {notCoded?.unweighted_n != null ? (
        <p className="flow-muted">Not coded: {notCoded.unweighted_n}</p>
      ) : null}
    </div>
  );
}

export function ThemesPanel({
  datasetId,
  onSelectCell,
}: {
  datasetId?: string;
  onSelectCell: (cell: SurveyCell) => void;
}) {
  const [columns, setColumns] = useState<string[]>([]);
  const [stub, setStub] = useState('');
  const [banner, setBanner] = useState('');
  const [weight, setWeight] = useState('');
  const [book, setBook] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!datasetId) return;
    void flowJson<{ columns?: { name?: string }[] }>(`/datasets/${datasetId}/metadata`)
      .then(meta => setColumns(columnNames(meta.columns || [])))
      .catch(() => setColumns([]));
  }, [datasetId]);
  return (
    <div className="flow-panel">
      <h2>Themes</h2>
      <div className="flow-row">
        <ChoiceSelect
          className="flow-input"
          value={stub}
          onValueChange={setStub}
          options={[
            { value: '', label: 'Theme column' },
            ...columns.map(column => ({ value: column, label: column })),
          ]}
        />
        <ChoiceSelect
          className="flow-input"
          value={banner}
          onValueChange={setBanner}
          options={[
            { value: '', label: 'Banner' },
            ...columns.map(column => ({ value: column, label: column })),
          ]}
        />
        <ChoiceSelect
          className="flow-input"
          value={weight}
          onValueChange={setWeight}
          options={[
            { value: '', label: 'Unweighted' },
            ...columns.map(column => ({ value: column, label: column })),
          ]}
        />
        <Button
          className="flow-btn primary"
          type="button"
          disabled={!datasetId || !stub}
          onClick={() => {
            if (!datasetId || !stub) return;
            setError('');
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
              .then(setBook)
              .catch(err => setError(err instanceof Error ? err.message : 'Themes did not run'));
          }}
        >
          Run themes
        </Button>
      </div>
      {error ? <p className="flow-error">{error}</p> : null}
      {book ? <BannerGrid book={book} onSelectCell={onSelectCell} /> : null}
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
  const [error, setError] = useState('');
  const [syntaxNote, setSyntaxNote] = useState('');
  useEffect(() => {
    if (!datasetId || !cell?.bitset || !cell.textColumn) {
      setQuotes(null);
      if (cell && !cell.bitset)
        setError('This cell has no respondent bitset, so the verbatims cannot be listed.');
      return;
    }
    setError('');
    void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/quotes`, {
      method: 'POST',
      body: JSON.stringify({
        text_column: cell.textColumn,
        row_uid_bitset: cell.bitset,
        page: 1,
        page_size: 20,
      }),
    })
      .then(setQuotes)
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load verbatims'));
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
        <p className="evidence-percent">{cell.percent || '—'}</p>
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
        <p className="flow-muted">
          <span>What they said</span>
          <span>{total || shown}</span>
        </p>
        {items.map(item => (
          <article key={item.respondent_id}>
            <p>{item.text}</p>
            <p className="flow-muted">{item.respondent_id}</p>
          </article>
        ))}
        {total > shown ? (
          <p className="flow-muted">
            Showing {shown} of {total}
          </p>
        ) : null}
      </div>
      <div className="evidence-actions">
        {projectId ? (
          <Button className="flow-btn" type="button" asChild>
            <Link href={`/flow/p/${projectId}/tables`}>Open table</Link>
          </Button>
        ) : null}
        <Button className="flow-btn" type="button" onClick={() => setSyntaxNote('This cell has no stored syntax.')}>
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

export function TablesBuilder({
  datasetId,
  projectId,
}: {
  datasetId?: string;
  projectId?: string;
}) {
  const router = useRouter();
  const [columns, setColumns] = useState<string[]>([]);
  const [specs, setSpecs] = useState<
    { spec_id?: string; id?: string; label?: string; name?: string }[]
  >([]);
  const [stub, setStub] = useState('');
  const [banner, setBanner] = useState('');
  const [weight, setWeight] = useState('');
  const [statistic, setStatistic] = useState('column_proportion');
  const [letters, setLetters] = useState(true);
  const [book, setBook] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!datasetId) return;
    void flowJson<{ specs?: { spec_id?: string; id?: string; label?: string; name?: string }[] }>(
      `/datasets/${datasetId}/tables`
    )
      .then(page => setSpecs(page.specs || []))
      .catch(() => setSpecs([]));
    void flowJson<{ columns?: { name?: string }[] }>(`/datasets/${datasetId}/metadata`)
      .then(meta => setColumns(columnNames(meta.columns || [])))
      .catch(() => setColumns([]));
  }, [datasetId]);

  function openCell(cell: SurveyCell) {
    setSurveyCell(cell);
    if (projectId) router.push(`/flow/p/${projectId}/responses`);
  }

  return (
    <div className="flow-panel">
      <h2>Table builder</h2>
      <form
        className="flow-row"
        onSubmit={event => {
          event.preventDefault();
          if (!datasetId || !stub) return;
          setError('');
          void flowJson<Record<string, unknown>>(`/datasets/${datasetId}/tables`, {
            method: 'POST',
            body: JSON.stringify({
              stubs: [codedStub(stub)],
              banner: banner ? [{ column: banner }] : [],
              statistics: [statistic],
              significance_display: letters ? 'column_letters' : 'none',
              weight: weight || 'none',
              save: true,
            }),
          })
            .then(body => {
              setBook(body);
              const spec = body.spec as { id?: string; label?: string } | undefined;
              const id = String(spec?.id || '');
              if (id) {
                setSpecs(current =>
                  current.some(item => (item.spec_id || item.id) === id)
                    ? current
                    : [{ spec_id: id, label: spec?.label || stub }, ...current]
                );
              }
            })
            .catch(err =>
              setError(err instanceof Error ? err.message : 'Could not save the table')
            );
        }}
      >
        <label>
          Stub
          <ChoiceSelect
            className="flow-input"
            aria-label="Table stub"
            value={stub}
            onValueChange={setStub}
            options={[
              { value: '', label: 'Column' },
              ...columns.map(column => ({ value: column, label: column })),
            ]}
          />
        </label>
        <label>
          Banner
          <ChoiceSelect
            className="flow-input"
            aria-label="Table banner"
            value={banner}
            onValueChange={setBanner}
            options={[
              { value: '', label: 'None' },
              ...columns.map(column => ({ value: column, label: column })),
            ]}
          />
        </label>
        <label>
          Weight
          <ChoiceSelect
            className="flow-input"
            aria-label="Table weight"
            value={weight}
            onValueChange={setWeight}
            options={[
              { value: '', label: 'Unweighted' },
              ...columns.map(column => ({ value: column, label: column })),
            ]}
          />
        </label>
        <label>
          Statistic
          <ChoiceSelect
            className="flow-input"
            aria-label="Table statistic"
            value={statistic}
            onValueChange={setStatistic}
            options={[
              { value: 'column_proportion', label: 'Column %' },
              { value: 'row_proportion', label: 'Row %' },
              { value: 'unweighted_n', label: 'Count' },
            ]}
          />
        </label>
        <label>
          <Checkbox checked={letters} onCheckedChange={checked => setLetters(checked === true)} />{' '}
          Sig letters
        </label>
        <Button className="flow-btn primary" type="submit" disabled={!stub}>
          Save table
        </Button>
      </form>
      {error ? <p className="flow-error">{error}</p> : null}
      <ul>
        {specs.map(spec => {
          const id = spec.spec_id || spec.id || '';
          return (
            <li key={id}>
              <Button
                className="flow-btn"
                type="button"
                onClick={() => {
                  void flowJson<Record<string, unknown>>(
                    `/datasets/${datasetId}/tables/${id}`
                  ).then(setBook);
                }}
              >
                {spec.label || spec.name || id}
              </Button>
            </li>
          );
        })}
      </ul>
      {book ? <BannerGrid book={book} onSelectCell={openCell} /> : null}
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
