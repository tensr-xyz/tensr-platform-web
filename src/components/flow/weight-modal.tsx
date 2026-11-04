'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { flowJson } from '@/lib/flow-api';
import { isIdColumn, isInternalColumn } from '@/lib/flow-columns';
import { efficiencyPercent } from '@/lib/flow-survey';
import { RAKE_COPY } from '@/lib/rake-weights';
import {
  achievedShare,
  categoryMeanWeight,
  countsFromPercents,
  marginFor,
  shareLabel,
  type WeightCode,
  type WeightMargin,
} from '@/components/flow/weight-targets';

type WeightDataset = {
  dataset_id?: string;
  id?: string;
  original_filename?: string;
  n_rows?: number;
};

type FrequencyBody = {
  frequencies?: { value: string; count?: number; percentage: number }[];
  total_count?: number;
};

type RakeDiagnostics = {
  weighting_efficiency?: number;
  kish_ess?: number;
  min_weight?: number;
  max_weight?: number;
  iterations?: number;
  converged?: boolean;
  margins?: WeightMargin[];
  missing_category_warning?: string;
};

type RakePayload = {
  derived_dataset_id?: string;
  dataset_id?: string;
  original_filename?: string;
  diagnostics?: RakeDiagnostics;
};

export type RakePreview = {
  ok?: boolean;
  needs_choice?: boolean;
  message?: string;
  audit?: { affected_rows?: number; per_variable?: { column: string; missing_rows?: number }[] };
  cells?: {
    column: string;
    level: string;
    label: string;
    n: number;
    unweighted_pct: number;
    weighted_pct: number;
    target_pct: number;
    mean_weight: number | null;
  }[];
  efficiency?: number;
  effective_base?: number;
  min_weight?: number;
  max_weight?: number;
  converged?: boolean;
  warning?: string;
};

export type MissingChoice = '' | 'keep_unweighted' | 'missing_target' | 'exclude';

/** Columns a target can use: no ids, no weights, no system columns. */
/** The name the saved weight column gets; the same rule as the API's rake_output_column. */
export function rakeOutputColumn(names: string[]): string {
  const taken = new Set(names.map(name => name.toLowerCase()));
  if (!taken.has('weight')) return 'weight';
  if (!taken.has('rake_weight')) return 'rake_weight';
  let suffix = 2;
  while (taken.has(`weight_${suffix}`)) suffix += 1;
  return `weight_${suffix}`;
}

export function targetColumns(
  columns: { name: string; label?: string }[],
  weightColumns: string[]
): { name: string; label?: string }[] {
  const weights = new Set(weightColumns);
  return columns.filter(
    column =>
      !isInternalColumn(column.name) &&
      !isIdColumn(column.name) &&
      !isIdColumn(column.label || '') &&
      !weights.has(column.name) &&
      !/(^|_)(weight|wt|wgt)s?($|_)/i.test(column.name)
  );
}

/** The preview cell for a code, matching "1" and "1.0". */
export function previewCell(preview: RakePreview | null, column: string, code: string) {
  const key = code.trim().replace(/\.0$/, '');
  return (preview?.cells || []).find(
    cell => cell.column === column && cell.level.trim().replace(/\.0$/, '') === key
  );
}

type WeightGroup = {
  column: string;
  total: number;
  codes: WeightCode[];
};

function rowId(row: WeightDataset): string {
  return row.dataset_id || row.id || '';
}

export function WeightPanel({
  datasetId,
  datasets,
  onClose,
  onAdopted,
  rerake = false,
}: {
  datasetId?: string;
  datasets: WeightDataset[];
  onClose: () => void;
  onAdopted?: (datasetId: string) => void;
  /** Prefill the same targets from the file's weight record and focus on saving a new version. */
  rerake?: boolean;
}) {
  const [columns, setColumns] = useState<{ name: string; label?: string }[]>([]);
  const [labels, setLabels] = useState<Record<string, Record<string, string>>>({});
  const [weightColumns, setWeightColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<RakePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [handling, setHandling] = useState<MissingChoice>('');
  const [missingPct, setMissingPct] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<{ id: string; name: string } | null>(null);
  const [groups, setGroups] = useState<WeightGroup[]>([]);
  const [percents, setPercents] = useState<Record<string, Record<string, string>>>({});
  const [addColumn, setAddColumn] = useState('');
  const [sourceDataset, setSourceDataset] = useState('');
  const [cap, setCap] = useState('');
  const [diagnostics, setDiagnostics] = useState<RakeDiagnostics | null>(null);
  const [savedName, setSavedName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const outputColumn = rakeOutputColumn(columns.map(column => column.name));
  const openFile = datasets.find(row => rowId(row) === datasetId);
  const lead = [
    openFile?.original_filename,
    openFile?.n_rows ? `${openFile.n_rows.toLocaleString('en-GB')} rows` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const loadColumn = (column: string, fileId: string) =>
    flowJson<FrequencyBody>(`/datasets/${fileId}/explore/column_frequencies`, {
      method: 'POST',
      body: JSON.stringify({ column }),
    });

  useEffect(() => {
    if (!datasetId) return;
    void flowJson<{
      columns?: { name?: string; label?: string; value_labels?: Record<string, string> | null }[];
      weight_columns?: string[];
      active_weight_column?: string | null;
      weight_vector?: {
        needs_refresh?: boolean;
        diagnostics?: { targets?: Record<string, Record<string, number>> };
      } | null;
    }>(`/datasets/${datasetId}/metadata`)
      .then(async meta => {
        const listed = (meta.columns || []).filter(column => column.name);
        setColumns(listed.map(column => ({ name: column.name || '', label: column.label || '' })));
        setLabels(
          Object.fromEntries(listed.map(column => [column.name || '', column.value_labels || {}]))
        );
        setWeightColumns(
          [...(meta.weight_columns || []), meta.active_weight_column || ''].filter(
            (name, index, all) => Boolean(name) && name !== '_weight' && all.indexOf(name) === index
          )
        );
        const refresh = Boolean(meta.weight_vector?.needs_refresh);
        setNeedsRefresh(refresh);
        const stored = meta.weight_vector?.diagnostics?.targets;
        if (!(rerake || refresh) || !stored || !Object.keys(stored).length) return;
        const loaded = await Promise.all(
          Object.entries(stored).map(async ([column, levels]) => {
            const body = await loadColumn(column, datasetId);
            const codes = (body.frequencies || []).map(row => ({
              code: String(row.value),
              count: Number(row.count || 0),
              percentage: Number(row.percentage || 0),
            }));
            const total = Number(
              body.total_count || codes.reduce((sum, row) => sum + row.count, 0)
            );
            const targetSum = Object.values(levels).reduce((sum, value) => sum + Number(value), 0);
            const columnPercents = Object.fromEntries(
              Object.entries(levels).map(([code, value]) => [
                code,
                String(Math.round((Number(value) / (targetSum || 1)) * 1000) / 10),
              ])
            );
            return { column, total, codes, columnPercents };
          })
        );
        setGroups(
          loaded.map(item => ({ column: item.column, total: item.total, codes: item.codes }))
        );
        setPercents(Object.fromEntries(loaded.map(item => [item.column, item.columnPercents])));
      })
      .catch(() => setColumns([]));
  }, [datasetId, rerake]);

  const addTarget = () => {
    if (!datasetId || !addColumn || groups.some(group => group.column === addColumn)) return;
    const column = addColumn;
    setError('');
    void loadColumn(column, datasetId)
      .then(body => {
        const codes = (body.frequencies || []).map(row => ({
          code: String(row.value),
          count: Number(row.count || 0),
          percentage: Number(row.percentage || 0),
        }));
        const total = Number(body.total_count || codes.reduce((sum, row) => sum + row.count, 0));
        setGroups(current => [...current, { column, total, codes }]);
        setPercents(current => ({ ...current, [column]: {} }));
        setAddColumn('');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not read that column'));
  };

  const setPercent = (column: string, code: string, percent: string) => {
    setPercents(current => ({
      ...current,
      [column]: { ...current[column], [code]: percent },
    }));
  };

  const loadTargets = () => {
    if (!sourceDataset || !groups.length) return;
    setError('');
    void Promise.all(
      groups.map(group => loadColumn(group.column, sourceDataset).then(body => ({ group, body })))
    )
      .then(loaded => {
        setPercents(current => {
          const next = { ...current };
          for (const item of loaded) {
            const columnPercents = { ...next[item.group.column] };
            for (const frequency of item.body.frequencies || []) {
              columnPercents[String(frequency.value)] = String(
                Math.round(Number(frequency.percentage) * 1000) / 10
              );
            }
            next[item.group.column] = columnPercents;
          }
          return next;
        });
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load targets'));
  };

  const requestBody = (previewOnly: boolean) => {
    const categorical: Record<string, Record<string, number>> = {};
    for (const group of groups) {
      const counts = countsFromPercents(
        group.codes.map(code => ({
          code: code.code,
          percent: percents[group.column]?.[code.code] || '',
        })),
        group.total
      );
      if (Object.keys(counts).length) categorical[group.column] = counts;
    }
    if (!Object.keys(categorical).length) return null;
    const upper = Number(cap);
    const missingTargets = Object.fromEntries(
      Object.entries(missingPct)
        .filter(
          ([column, value]) => categorical[column] && Number.isFinite(Number(value)) && value.trim()
        )
        .map(([column, value]) => {
          const total = groups.find(group => group.column === column)?.total || 0;
          return [column, (Number(value) / 100) * total];
        })
    );
    return {
      categorical_targets: categorical,
      ...(handling ? { missing_handling: handling } : {}),
      ...(handling === 'missing_target' ? { missing_targets: missingTargets } : {}),
      ...(Number.isFinite(upper) && upper > 0 ? { upper } : {}),
      ...(previewOnly ? { preview: true } : {}),
    };
  };

  const previewKey = JSON.stringify([
    percents,
    groups.map(group => group.column),
    cap,
    handling,
    missingPct,
  ]);
  useEffect(() => {
    if (!datasetId || saved) return;
    const body = requestBody(true);
    if (!body) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    const handle = window.setTimeout(() => {
      void flowJson<RakePreview>(`/datasets/${datasetId}/weights/rake`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
        .then(next => {
          if (!cancelled) setPreview(next);
        })
        .catch(err => {
          if (!cancelled)
            setPreview({ ok: false, message: err instanceof Error ? err.message : '' });
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false);
        });
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // The key holds every input of the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, previewKey, saved]);

  const needsChoice = Boolean(preview?.needs_choice) && !handling;

  const save = () => {
    if (!datasetId) return;
    const body = requestBody(false);
    if (!body) {
      setError('Enter a target percent for at least one code.');
      return;
    }
    if (needsChoice) {
      setError('Choose what happens to rows with no target category first.');
      return;
    }
    setBusy(true);
    setError('');
    void flowJson<RakePayload>(`/datasets/${datasetId}/weights/rake`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
      .then(payload => {
        setDiagnostics(payload.diagnostics || null);
        const name = payload.original_filename || 'the new file';
        setSavedName(name);
        const nextId = String(payload.derived_dataset_id || payload.dataset_id || '');
        if (nextId) setSaved({ id: nextId, name });
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Raking did not finish'))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="weight-dialog">
        <div className="weight-top">
          <DialogHeader>
            {lead ? <p className="weight-lead">{lead}</p> : null}
            <DialogTitle className="weight-title">Weight to targets</DialogTitle>
            <DialogDescription className="weight-copy">{RAKE_COPY}</DialogDescription>
          </DialogHeader>
          <div className="weight-versions-head">
            <span>Weight variable · {outputColumn}</span>
            <span>Targets are a percent of each column&apos;s rows, sent as counts</span>
          </div>
          <div className="weight-versions">
            <div className="weight-version">
              <i />
              <div>
                <strong>{openFile?.original_filename || 'Open file'}</strong>
                <span>Current file · stays as it is</span>
              </div>
            </div>
            <div className="weight-version" data-active>
              <i />
              <div>
                <strong>{savedName || 'New weighted file'}</strong>
                <span>This rake · adds a {outputColumn} column</span>
              </div>
              <span className="weight-new">New</span>
            </div>
          </div>
          <p className="weight-note">Nothing is overwritten. Outputs keep the file they ran on.</p>
          {needsRefresh || rerake ? (
            <p className="flow-banner warn weight-refresh" role="status">
              Made before a weighting fix · re-run. The same targets are filled in below — save to
              switch to the new weighted file.
            </p>
          ) : null}
        </div>
        <div className="weight-table">
          <div className="weight-row weight-head-row">
            <span>Variable · code</span>
            <span>Unweighted</span>
            <span>Target</span>
            <span>Weighted</span>
            <span>Weight</span>
          </div>
          {groups.length === 0 ? (
            <p className="weight-empty">Add a target variable below to set its shares.</p>
          ) : null}
          {groups.map(group => (
            <section key={group.column} className="weight-group">
              <h3>{group.column}</h3>
              {group.codes.map(code => {
                const cell = previewCell(preview, group.column, code.code);
                const margin = cell
                  ? undefined
                  : marginFor(diagnostics?.margins, group.column, code.code);
                const mean =
                  cell && cell.mean_weight != null
                    ? cell.mean_weight.toFixed(2)
                    : margin
                      ? categoryMeanWeight(margin.achieved, code.count)
                      : '';
                const label =
                  labels[group.column]?.[code.code] ||
                  labels[group.column]?.[code.code.replace(/\.0$/, '')];
                const capped = mean && Number(cap) > 0 && Number(mean) >= Number(cap);
                return (
                  <div
                    key={code.code}
                    className="weight-row"
                    data-capped={capped ? 'true' : 'false'}
                  >
                    <span>
                      {label ? (
                        <>
                          {label} <span className="weight-code">{code.code}</span>
                        </>
                      ) : (
                        code.code
                      )}
                      {capped ? ` · capped at ${cap}` : ''}
                    </span>
                    <span className="weight-muted">{shareLabel(code.percentage)}</span>
                    <span className="weight-target">
                      <Input
                        aria-label={`Target percent ${group.column} ${code.code}`}
                        value={percents[group.column]?.[code.code] || ''}
                        onChange={event => setPercent(group.column, code.code, event.target.value)}
                      />
                      %
                    </span>
                    <span>
                      {cell
                        ? `${cell.weighted_pct.toFixed(1)}%`
                        : margin
                          ? achievedShare(margin.achieved, group.total)
                          : '—'}
                    </span>
                    <span>{mean || '—'}</span>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        <div className="weight-stats">
          <div>
            <span>Efficiency</span>
            <strong>
              {preview?.efficiency != null
                ? efficiencyPercent(preview.efficiency) || '—'
                : diagnostics
                  ? efficiencyPercent(diagnostics.weighting_efficiency) || '—'
                  : '—'}
            </strong>
          </div>
          <div>
            <span>Effective base</span>
            <strong>
              {Number.isFinite(Number(preview?.effective_base ?? diagnostics?.kish_ess))
                ? Number(preview?.effective_base ?? diagnostics?.kish_ess).toLocaleString('en-GB', {
                    maximumFractionDigits: 1,
                  })
                : '—'}
            </strong>
          </div>
          <div>
            <span>Weight range</span>
            <strong>
              {Number.isFinite(Number(preview?.min_weight ?? diagnostics?.min_weight)) &&
              Number.isFinite(Number(preview?.max_weight ?? diagnostics?.max_weight))
                ? `${Number(preview?.min_weight ?? diagnostics?.min_weight).toFixed(2)} to ${Number(
                    preview?.max_weight ?? diagnostics?.max_weight
                  ).toFixed(2)}`
                : '—'}
            </strong>
          </div>
          <div>
            <span>Converged</span>
            <strong>
              {diagnostics?.converged && diagnostics.iterations
                ? `${diagnostics.iterations} ${diagnostics.iterations === 1 ? 'run' : 'runs'}`
                : '—'}
            </strong>
          </div>
        </div>
        {preview?.needs_choice ? (
          <div className="weight-choice" role="alert">
            <p>
              <strong>{preview.audit?.affected_rows || 0} rows have no target category</strong> (
              {(preview.audit?.per_variable || [])
                .filter(item => item.missing_rows)
                .map(item => `${item.column}: ${item.missing_rows} missing`)
                .join('; ')}
              ). Choose what happens to them before saving.
            </p>
            <div className="weight-choice-options">
              {(
                [
                  ['keep_unweighted', 'Keep them at weight 1'],
                  ['missing_target', 'Treat missing as its own category'],
                  ['exclude', 'Leave them out (weight 0)'],
                ] as const
              ).map(([value, text]) => (
                <Button
                  key={value}
                  type="button"
                  className="flow-btn"
                  data-active={handling === value || undefined}
                  onClick={() => setHandling(value)}
                >
                  {text}
                </Button>
              ))}
            </div>
            {handling === 'missing_target'
              ? (preview.audit?.per_variable || [])
                  .filter(item => item.missing_rows)
                  .map(item => (
                    <label key={item.column} className="weight-missing-target">
                      Target for missing {item.column}
                      <Input
                        aria-label={`Target percent missing ${item.column}`}
                        value={missingPct[item.column] || ''}
                        onChange={event =>
                          setMissingPct(current => ({
                            ...current,
                            [item.column]: event.target.value,
                          }))
                        }
                      />
                      %
                    </label>
                  ))
              : null}
          </div>
        ) : null}
        {savedName || diagnostics?.missing_category_warning || preview?.warning || error ? (
          <div className="weight-messages">
            {savedName ? (
              <p className="flow-muted">
                Saved as {savedName}. The file you raked stays in the project.
              </p>
            ) : null}
            {diagnostics?.missing_category_warning || (!savedName && preview?.warning) ? (
              <p className="flow-muted">
                {diagnostics?.missing_category_warning || preview?.warning}
              </p>
            ) : null}
            {error ? <p className="flow-error">{error}</p> : null}
          </div>
        ) : null}
        <div className="weight-foot">
          <ChoiceSelect
            className="weight-link"
            aria-label="Add target column"
            value={addColumn}
            onValueChange={value => {
              setAddColumn(value);
            }}
            options={[
              { value: '', label: '+ Add target' },
              ...targetColumns(columns, weightColumns)
                .filter(column => !groups.some(group => group.column === column.name))
                .map(column => ({
                  value: column.name,
                  label:
                    column.label && column.label !== column.name
                      ? `${column.name} · ${column.label}`
                      : column.name,
                })),
            ]}
          />
          {addColumn ? (
            <Button className="weight-text" type="button" onClick={addTarget}>
              Add
            </Button>
          ) : null}
          <ChoiceSelect
            className="weight-link"
            aria-label="Load targets from"
            value={sourceDataset}
            onValueChange={setSourceDataset}
            options={[
              { value: '', label: 'Load targets from…' },
              ...datasets
                .filter(row => rowId(row) && rowId(row) !== datasetId)
                .map(row => ({ value: rowId(row), label: row.original_filename || rowId(row) })),
            ]}
          />
          {sourceDataset ? (
            <Button className="weight-text" type="button" onClick={loadTargets}>
              Load
            </Button>
          ) : null}
          <span className="weight-cap">
            Cap
            <Input
              aria-label="Weight cap"
              value={cap}
              placeholder="none"
              onChange={event => setCap(event.target.value)}
            />
          </span>
          <span className="sheet-spacer" />
          {previewing && !saved ? (
            <span className="flow-muted weight-previewing">Updating…</span>
          ) : null}
          <Button className="flow-btn" type="button" onClick={onClose}>
            {saved ? 'Close' : 'Cancel'}
          </Button>
          {saved ? (
            <Button
              className="flow-btn primary"
              type="button"
              onClick={() => {
                onAdopted?.(saved.id);
                onClose();
              }}
            >
              Open weighted file
            </Button>
          ) : (
            <Button
              className="flow-btn primary"
              type="button"
              disabled={!datasetId || busy || needsChoice}
              onClick={save}
            >
              {busy ? 'Saving…' : 'Save as new file'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
