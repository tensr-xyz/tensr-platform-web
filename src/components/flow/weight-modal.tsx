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
}: {
  datasetId?: string;
  datasets: WeightDataset[];
  onClose: () => void;
  onAdopted?: (datasetId: string) => void;
}) {
  const [columns, setColumns] = useState<string[]>([]);
  const [groups, setGroups] = useState<WeightGroup[]>([]);
  const [percents, setPercents] = useState<Record<string, Record<string, string>>>({});
  const [addColumn, setAddColumn] = useState('');
  const [sourceDataset, setSourceDataset] = useState('');
  const [cap, setCap] = useState('');
  const [diagnostics, setDiagnostics] = useState<RakeDiagnostics | null>(null);
  const [savedName, setSavedName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openFile = datasets.find(row => rowId(row) === datasetId);
  const lead = [
    openFile?.original_filename,
    openFile?.n_rows ? `${openFile.n_rows.toLocaleString('en-GB')} rows` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  useEffect(() => {
    if (!datasetId) return;
    void flowJson<{ columns?: { name?: string }[] }>(`/datasets/${datasetId}/metadata`)
      .then(meta =>
        setColumns((meta.columns || []).map(column => column.name || '').filter(Boolean))
      )
      .catch(() => setColumns([]));
  }, [datasetId]);

  const loadColumn = (column: string, fileId: string) =>
    flowJson<FrequencyBody>(`/datasets/${fileId}/explore/column_frequencies`, {
      method: 'POST',
      body: JSON.stringify({ column }),
    });

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

  const save = () => {
    if (!datasetId) return;
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
    if (!Object.keys(categorical).length) {
      setError('Enter a target percent for at least one code.');
      return;
    }
    const upper = Number(cap);
    setBusy(true);
    setError('');
    void flowJson<RakePayload>(`/datasets/${datasetId}/weights/rake`, {
      method: 'POST',
      body: JSON.stringify({
        categorical_targets: categorical,
        missing_handling: 'exclude',
        ...(Number.isFinite(upper) && upper > 0 ? { upper } : {}),
      }),
    })
      .then(payload => {
        setDiagnostics(payload.diagnostics || null);
        setSavedName(payload.original_filename || 'the new file');
        const nextId = String(payload.derived_dataset_id || payload.dataset_id || '');
        if (nextId) onAdopted?.(nextId);
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
        <DialogHeader>
          {lead ? <p className="flow-muted weight-lead">{lead}</p> : null}
          <DialogTitle className="weight-title">Weight to targets</DialogTitle>
          <DialogDescription>{RAKE_COPY}</DialogDescription>
        </DialogHeader>
        <p className="flow-muted weight-lead">
          The new file adds a _weight column. Targets are a percent of that column&apos;s rows, sent
          as counts.
        </p>
        {groups.map(group => (
          <section key={group.column} className="weight-group">
            <h3>{group.column}</h3>
            <div className="weight-row weight-head-row">
              <span>Code</span>
              <span>Unweighted</span>
              <span>Target</span>
              <span>Weighted</span>
              <span>Weight</span>
            </div>
            {group.codes.map(code => {
              const margin = marginFor(diagnostics?.margins, group.column, code.code);
              const mean = margin ? categoryMeanWeight(margin.achieved, code.count) : '';
              const capped = mean && Number(cap) > 0 && Number(mean) >= Number(cap);
              return (
                <div key={code.code} className="weight-row" data-capped={capped ? 'true' : 'false'}>
                  <span>{code.code}</span>
                  <span className="flow-muted">{shareLabel(code.percentage)}</span>
                  <Input
                    aria-label={`Target percent ${group.column} ${code.code}`}
                    value={percents[group.column]?.[code.code] || ''}
                    onChange={event => setPercent(group.column, code.code, event.target.value)}
                  />
                  <span>{margin ? achievedShare(margin.achieved, group.total) : ''}</span>
                  <span>{mean}</span>
                </div>
              );
            })}
          </section>
        ))}
        {diagnostics ? (
          <div className="weight-stats">
            <div>
              <span className="flow-muted">Efficiency</span>
              <span className="weight-figure">
                {efficiencyPercent(diagnostics.weighting_efficiency) || '—'}
              </span>
            </div>
            <div>
              <span className="flow-muted">Effective base</span>
              <span className="weight-figure">
                {Number.isFinite(Number(diagnostics.kish_ess))
                  ? Number(diagnostics.kish_ess).toLocaleString('en-GB', {
                      maximumFractionDigits: 1,
                    })
                  : '—'}
              </span>
            </div>
            <div>
              <span className="flow-muted">Weight range</span>
              <span className="weight-figure">
                {Number.isFinite(Number(diagnostics.min_weight)) &&
                Number.isFinite(Number(diagnostics.max_weight))
                  ? `${Number(diagnostics.min_weight).toFixed(2)} to ${Number(diagnostics.max_weight).toFixed(2)}`
                  : '—'}
              </span>
            </div>
            <div>
              <span className="flow-muted">Converged</span>
              <span className="weight-figure">
                {diagnostics.converged && diagnostics.iterations
                  ? `${diagnostics.iterations} runs`
                  : '—'}
              </span>
            </div>
          </div>
        ) : null}
        {savedName ? (
          <p className="flow-muted">
            Saved as {savedName}. The file you raked stays in the project.
          </p>
        ) : null}
        {diagnostics?.missing_category_warning ? (
          <p className="flow-muted">{diagnostics.missing_category_warning}</p>
        ) : null}
        {error ? <p className="flow-error">{error}</p> : null}
        <div className="weight-foot">
          <ChoiceSelect
            aria-label="Add target column"
            value={addColumn}
            onValueChange={setAddColumn}
            options={[
              { value: '', label: 'Variable' },
              ...columns
                .filter(column => !groups.some(group => group.column === column))
                .map(column => ({ value: column, label: column })),
            ]}
          />
          <Button className="flow-btn" type="button" onClick={addTarget} disabled={!addColumn}>
            Add target
          </Button>
          <ChoiceSelect
            aria-label="Load targets from"
            value={sourceDataset}
            onValueChange={setSourceDataset}
            options={[
              { value: '', label: 'Dataset in this project' },
              ...datasets
                .filter(row => rowId(row) && rowId(row) !== datasetId)
                .map(row => ({ value: rowId(row), label: row.original_filename || rowId(row) })),
            ]}
          />
          <Button
            className="flow-btn"
            type="button"
            onClick={loadTargets}
            disabled={!sourceDataset}
          >
            Load targets
          </Button>
          <Input
            aria-label="Weight cap"
            value={cap}
            placeholder="Cap"
            onChange={event => setCap(event.target.value)}
          />
          <span className="sheet-spacer" />
          <Button className="flow-btn" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="sources-ink"
            type="button"
            disabled={!datasetId || busy}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save as new file'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
