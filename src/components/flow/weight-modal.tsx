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
import { isInternalColumn } from '@/lib/flow-columns';
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
        <div className="weight-top">
          <DialogHeader>
            {lead ? <p className="weight-lead">{lead}</p> : null}
            <DialogTitle className="weight-title">Weight to targets</DialogTitle>
            <DialogDescription className="weight-copy">{RAKE_COPY}</DialogDescription>
          </DialogHeader>
          <div className="weight-versions-head">
            <span>Weight variable · _weight</span>
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
                <span>This rake · adds a _weight column</span>
              </div>
              <span className="weight-new">New</span>
            </div>
          </div>
          <p className="weight-note">Nothing is overwritten. Outputs keep the file they ran on.</p>
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
                const margin = marginFor(diagnostics?.margins, group.column, code.code);
                const mean = margin ? categoryMeanWeight(margin.achieved, code.count) : '';
                const capped = mean && Number(cap) > 0 && Number(mean) >= Number(cap);
                return (
                  <div
                    key={code.code}
                    className="weight-row"
                    data-capped={capped ? 'true' : 'false'}
                  >
                    <span>
                      {code.code}
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
                    <span>{margin ? achievedShare(margin.achieved, group.total) : '—'}</span>
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
              {diagnostics ? efficiencyPercent(diagnostics.weighting_efficiency) || '—' : '—'}
            </strong>
          </div>
          <div>
            <span>Effective base</span>
            <strong>
              {diagnostics && Number.isFinite(Number(diagnostics.kish_ess))
                ? Number(diagnostics.kish_ess).toLocaleString('en-GB', {
                    maximumFractionDigits: 1,
                  })
                : '—'}
            </strong>
          </div>
          <div>
            <span>Weight range</span>
            <strong>
              {diagnostics &&
              Number.isFinite(Number(diagnostics.min_weight)) &&
              Number.isFinite(Number(diagnostics.max_weight))
                ? `${Number(diagnostics.min_weight).toFixed(2)} to ${Number(diagnostics.max_weight).toFixed(2)}`
                : '—'}
            </strong>
          </div>
          <div>
            <span>Converged</span>
            <strong>
              {diagnostics?.converged && diagnostics.iterations
                ? `${diagnostics.iterations} runs`
                : '—'}
            </strong>
          </div>
        </div>
        {savedName || diagnostics?.missing_category_warning || error ? (
          <div className="weight-messages">
            {savedName ? (
              <p className="flow-muted">
                Saved as {savedName}. The file you raked stays in the project.
              </p>
            ) : null}
            {diagnostics?.missing_category_warning ? (
              <p className="flow-muted">{diagnostics.missing_category_warning}</p>
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
              ...columns
                .filter(column => !isInternalColumn(column))
                .filter(column => !groups.some(group => group.column === column))
                .map(column => ({ value: column, label: column })),
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
          <Button className="flow-btn" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flow-btn primary"
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
