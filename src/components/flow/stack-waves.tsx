'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChoiceSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/rest';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { datasetRowId } from '@/components/flow/survey-screens';
import { moveDatasetToProject, type MovableDataset } from '@/components/flow/move-dataset';
import { Checkbox } from '@/components/ui/checkbox';
import { flowJson } from '@/lib/flow-api';

export type WaveColumn = { name: string; value_labels?: Record<string, string> };

export type WaveDiff = {
  id: string;
  left: string;
  right: string;
  reason: string;
  kind: 'matched' | 'check' | 'new';
};

const EMPTY = '—';

function labelReason(left: WaveColumn, right: WaveColumn): string | null {
  const a = Object.keys(left.value_labels || {});
  const b = Object.keys(right.value_labels || {});
  if (!a.length || !b.length) return null;
  const aSet = new Set(a);
  const bSet = new Set(b);
  const added = b.filter(key => !aSet.has(key));
  const removed = a.filter(key => !bSet.has(key));
  if (!added.length && !removed.length) return null;
  const parts = [];
  if (added.length) parts.push(`${added.slice(0, 3).join(', ')} only on the right`);
  if (removed.length) parts.push(`${removed.slice(0, 3).join(', ')} only on the left`);
  return `Value labels differ: ${parts.join('; ')}`;
}

export function compareWaves(
  left: WaveColumn[],
  right: WaveColumn[],
  leftName: string,
  rightName: string
): WaveDiff[] {
  const leftByName = new Map(
    left.filter(column => column.name).map(column => [column.name, column])
  );
  const rightByName = new Map(
    right.filter(column => column.name).map(column => [column.name, column])
  );
  const rows: WaveDiff[] = [];
  for (const [name, column] of leftByName) {
    const other = rightByName.get(name);
    if (!other) {
      rows.push({
        id: `${name}\t`,
        left: name,
        right: EMPTY,
        reason: `Only in ${leftName}`,
        kind: 'check',
      });
      continue;
    }
    const reason = labelReason(column, other);
    rows.push({
      id: `${name}\t${name}`,
      left: name,
      right: name,
      reason: reason || 'Same name',
      kind: reason ? 'check' : 'matched',
    });
  }
  for (const name of rightByName.keys()) {
    if (leftByName.has(name)) continue;
    rows.push({
      id: `\t${name}`,
      left: EMPTY,
      right: name,
      reason: `Only in ${rightName}`,
      kind: 'new',
    });
  }
  return rows;
}

export function waveCounts(rows: WaveDiff[]) {
  return {
    matched: rows.filter(row => row.kind === 'matched').length,
    check: rows.filter(row => row.kind === 'check').length,
    fresh: rows.filter(row => row.kind === 'new').length,
  };
}

type Decision = { decision: 'accept' | 'skip' | 'override'; target: string };

export function stackMappings(rows: WaveDiff[], choices: Record<string, Decision>) {
  return rows.map(row => {
    const choice = choices[row.id] || { decision: 'accept' as const, target: '' };
    const source = row.left !== EMPTY ? row.left : row.right;
    const target = choice.decision === 'override' ? choice.target || source : source;
    const decision =
      choice.decision === 'override' && target === source ? 'accept' : choice.decision;
    return { source_column: source, target_column: target, decision, note: row.reason };
  });
}

export type StackFile = MovableDataset & {
  parent_dataset_id?: string | null;
  archived?: boolean;
};

/** Original uploads first: this project's, then the ones in your other projects. */
export function stackCandidates(datasets: StackFile[], projectId: string) {
  const uploads = datasets.filter(
    row => datasetRowId(row) && !row.parent_dataset_id && !row.archived
  );
  return {
    here: uploads.filter(row => row.project_id === projectId),
    elsewhere: uploads.filter(row => row.project_id !== projectId),
  };
}

/** A file and one made from it can't stack: name the pair. */
export function descendantClash(ids: string[], datasets: StackFile[]): [string, string] | null {
  const byId = new Map(datasets.map(row => [datasetRowId(row), row]));
  for (const id of ids) {
    let parent = byId.get(id)?.parent_dataset_id || '';
    const seen = new Set<string>();
    while (parent && !seen.has(parent)) {
      if (ids.includes(parent)) return [id, parent];
      seen.add(parent);
      parent = byId.get(parent)?.parent_dataset_id || '';
    }
  }
  return null;
}

/** Columns across any number of files. A column in every file matches; others are flagged. */
export function compareManyWaves(files: { name: string; columns: WaveColumn[] }[]): WaveDiff[] {
  const names: string[] = [];
  for (const file of files) {
    for (const column of file.columns) {
      if (column.name && !names.includes(column.name)) names.push(column.name);
    }
  }
  return names.map(name => {
    const missing = files.filter(file => !file.columns.some(column => column.name === name));
    const inFirst = !missing.includes(files[0]);
    return {
      id: `${name}\t`,
      left: inFirst ? name : EMPTY,
      right: inFirst ? (missing.length ? EMPTY : name) : name,
      reason: missing.length
        ? `Not in ${missing.map(file => file.name).join(', ')}`
        : 'In every file',
      kind: missing.length ? (inFirst ? 'check' : 'new') : 'matched',
    } as WaveDiff;
  });
}

export function StackWaves({
  projectId,
  datasets,
  projectNames = {},
  onChanged,
  onDone,
}: {
  projectId: string;
  datasets: StackFile[];
  projectNames?: Record<string, string>;
  onChanged: () => void;
  onDone: () => void;
}) {
  const { here, elsewhere } = useMemo(
    () => stackCandidates(datasets, projectId),
    [datasets, projectId]
  );
  const [picked, setPicked] = useState<string[]>([]);
  const [columnsById, setColumnsById] = useState<Record<string, WaveColumn[]>>({});
  const [choices, setChoices] = useState<Record<string, Decision>>({});
  const [showAll, setShowAll] = useState(false);
  const [overlap, setOverlap] = useState<{ column: string | null; overlapping_ids: number } | null>(
    null
  );
  const [dedupe, setDedupe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (picked.length || here.length < 2) return;
    setPicked(here.map(row => datasetRowId(row)));
  }, [here, picked.length]);

  const pickedKey = picked.join('|');
  useEffect(() => {
    const missing = picked.filter(id => !columnsById[id]);
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(
      missing.map(id =>
        flowJson<{ columns?: WaveColumn[] }>(`/datasets/${id}/metadata`).then(
          meta => [id, meta.columns || []] as const
        )
      )
    )
      .then(rows => {
        if (!cancelled) setColumnsById(current => ({ ...current, ...Object.fromEntries(rows) }));
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'The columns did not load.');
      });
    return () => {
      cancelled = true;
    };
    // pickedKey covers picked; columnsById only grows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedKey]);

  useEffect(() => {
    setOverlap(null);
    if (picked.length < 2) return;
    let cancelled = false;
    void flowJson<{ column: string | null; overlapping_ids: number }>(
      '/datasets/intake/id-overlap',
      {
        method: 'POST',
        body: JSON.stringify({ dataset_ids: picked }),
      }
    )
      .then(result => {
        if (!cancelled) setOverlap(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // pickedKey covers picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedKey]);

  const byId = new Map(datasets.map(row => [datasetRowId(row), row]));
  const nameOf = (id: string) => byId.get(id)?.original_filename || 'File';
  const clash = descendantClash(picked, datasets);
  const ready = picked.length >= 2 && picked.every(id => columnsById[id]);
  const visibleCols = (list: WaveColumn[]) =>
    list.filter(column => !String(column.name || '').startsWith('_'));
  const rows = !ready
    ? []
    : picked.length === 2
      ? compareWaves(
          visibleCols(columnsById[picked[0]]),
          visibleCols(columnsById[picked[1]]),
          nameOf(picked[0]),
          nameOf(picked[1])
        )
      : compareManyWaves(
          picked.map(id => ({ name: nameOf(id), columns: visibleCols(columnsById[id]) }))
        );
  const counts = waveCounts(rows);
  const visible = showAll ? rows : rows.filter(row => row.kind !== 'matched');
  const toggle = (id: string, on: boolean) =>
    setPicked(current => (on ? [...current, id] : current.filter(item => item !== id)));
  const setDecision = (id: string, decision: Decision['decision'], target = '') =>
    setChoices(current => ({ ...current, [id]: { decision, target } }));

  const stack = () => {
    if (picked.length < 2 || clash || busy) return;
    setBusy(true);
    setError(null);
    const mappings = stackMappings(rows, choices);
    void flowJson(`/api/projects/${projectId}/wave-maps`, {
      method: 'POST',
      body: JSON.stringify({ sources: picked, mappings }),
    })
      .then(() =>
        flowJson<{ dataset_id?: string; derived_dataset_id?: string }>(
          '/datasets/intake/fuse-datasets',
          {
            method: 'POST',
            body: JSON.stringify({
              dataset_ids: picked,
              wave_names: picked.map(nameOf),
              mappings,
              ...(dedupe && overlap?.overlapping_ids && overlap.column
                ? { dedupe_column: overlap.column }
                : {}),
            }),
          }
        )
      )
      .then(fused => {
        const nextId = fused.derived_dataset_id || fused.dataset_id || '';
        if (!nextId) throw new Error('The stack did not return a dataset.');
        return moveDatasetToProject(projectId, nextId);
      })
      .then(() => {
        onChanged();
        onDone();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The stack did not save.'))
      .finally(() => setBusy(false));
  };

  const fileRow = (row: StackFile, other: boolean) => {
    const id = datasetRowId(row);
    return (
      <label key={id} className="stack-file">
        <Checkbox
          checked={picked.includes(id)}
          onCheckedChange={checked => toggle(id, checked === true)}
        />
        <span>{row.original_filename || id}</span>
        {other ? (
          <span className="flow-muted">
            {projectNames[row.project_id || ''] || 'Another project'}
          </span>
        ) : null}
      </label>
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Stack {picked.length >= 2 ? `${picked.length} files` : 'files'}</DialogTitle>
        <DialogDescription>
          Pick the original uploads to stack. Columns with the same name stack together; check the
          exceptions below.
        </DialogDescription>
      </DialogHeader>
      <div className="stack-picker">
        <p className="stack-picker-label">This project</p>
        {here.length ? (
          here.map(row => fileRow(row, false))
        ) : (
          <p className="flow-muted">No uploads here yet.</p>
        )}
        {elsewhere.length ? (
          <>
            <p className="stack-picker-label">Your other projects</p>
            {elsewhere.map(row => fileRow(row, true))}
          </>
        ) : null}
      </div>
      {clash ? (
        <p className="flow-error">
          {nameOf(clash[0])} was made from {nameOf(clash[1])}. Stack the original uploads instead.
        </p>
      ) : null}
      {overlap && overlap.overlapping_ids > 0 ? (
        <div className="stack-overlap">
          <span>
            {overlap.overlapping_ids.toLocaleString('en-GB')} respondent IDs in{' '}
            <strong>{overlap.column}</strong> appear in more than one file.
          </span>
          <label className="stack-file">
            <Checkbox checked={dedupe} onCheckedChange={checked => setDedupe(checked === true)} />
            <span>Keep one row per respondent (the first file&apos;s)</span>
          </label>
        </div>
      ) : null}
      {picked.length < 2 ? (
        <p className="flow-muted">Pick at least two files.</p>
      ) : !ready ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="stack-counts">
            <Badge tone="active">{counts.matched} matched</Badge>
            <Badge tone="warn">{counts.check} to check</Badge>
            <Badge>{counts.fresh} new</Badge>
          </div>
          {visible.length ? (
            <Table className="stack-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{picked.length === 2 ? nameOf(picked[0]) : 'Column'}</TableHead>
                  <TableHead>{picked.length === 2 ? nameOf(picked[1]) : 'Also in'}</TableHead>
                  <TableHead>Why it is flagged</TableHead>
                  <TableHead>Do this</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(row => {
                  const choice = choices[row.id] || { decision: 'accept' as const, target: '' };
                  const oneSided = row.left === EMPTY || row.right === EMPTY;
                  const twoFiles = picked.length === 2;
                  return (
                    <TableRow key={row.id} data-kind={row.kind}>
                      <TableCell>{row.left}</TableCell>
                      <TableCell>{row.right}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                      <TableCell>
                        <ChoiceSelect
                          aria-label={`Decision for ${row.left} ${row.right}`}
                          value={choice.decision}
                          onValueChange={value =>
                            setDecision(row.id, value as Decision['decision'], choice.target)
                          }
                          options={
                            oneSided && twoFiles
                              ? [
                                  { value: 'accept', label: 'Add' },
                                  { value: 'skip', label: 'Skip' },
                                  { value: 'override', label: 'Treat as same' },
                                ]
                              : [
                                  { value: 'accept', label: oneSided ? 'Add' : 'Stack together' },
                                  { value: 'skip', label: 'Skip' },
                                ]
                          }
                        />
                        {choice.decision === 'override' ? (
                          <ChoiceSelect
                            aria-label={`Same column as ${row.left === EMPTY ? row.right : row.left}`}
                            value={choice.target}
                            onValueChange={value => setDecision(row.id, 'override', value)}
                            placeholder="Choose a column"
                            options={(row.left === EMPTY
                              ? columnsById[picked[0]]
                              : columnsById[picked[1]]
                            )
                              .map(column => column.name)
                              .filter(Boolean)
                              .map(name => ({ value: name, label: name }))}
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="flow-muted">Every column name matches.</p>
          )}
        </>
      )}
      {error ? <p className="flow-error">{error}</p> : null}
      <div className="stack-foot">
        {ready ? (
          <Button
            className="stack-show-all"
            type="button"
            onClick={() => setShowAll(current => !current)}
          >
            {showAll ? 'Show exceptions' : `Show all ${rows.length} mappings`}
          </Button>
        ) : null}
        <p className="flow-muted">Creates a new working version; the uploads stay as they are</p>
        <Button className="flow-btn" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="flow-btn primary"
          type="button"
          disabled={busy || picked.length < 2 || Boolean(clash)}
          onClick={stack}
        >
          {busy
            ? 'Stacking…'
            : `Stack ${picked.length >= 2 ? picked.length : ''} files`.replace('  ', ' ')}
        </Button>
      </div>
    </>
  );
}
