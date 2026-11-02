'use client';

import { useEffect, useState } from 'react';
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

export function StackWaves({
  projectId,
  datasets,
  onChanged,
  onDone,
}: {
  projectId: string;
  datasets: MovableDataset[];
  onChanged: () => void;
  onDone: () => void;
}) {
  const files = datasets.filter(row => row.project_id === projectId && datasetRowId(row));
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [leftCols, setLeftCols] = useState<WaveColumn[] | null>(null);
  const [rightCols, setRightCols] = useState<WaveColumn[] | null>(null);
  const [choices, setChoices] = useState<Record<string, Decision>>({});
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leftId || files.length < 2) return;
    setLeftId(datasetRowId(files[0]));
    setRightId(datasetRowId(files[1]));
  }, [files, leftId]);

  useEffect(() => {
    if (!leftId || !rightId || leftId === rightId) {
      setLeftCols([]);
      setRightCols([]);
      return;
    }
    let cancelled = false;
    setLeftCols(null);
    setRightCols(null);
    const load = (id: string) =>
      flowJson<{ columns?: WaveColumn[] }>(`/datasets/${id}/metadata`).then(
        meta => meta.columns || []
      );
    void Promise.all([load(leftId), load(rightId)])
      .then(([left, right]) => {
        if (cancelled) return;
        setLeftCols(left);
        setRightCols(right);
      })
      .catch(err => {
        if (cancelled) return;
        setLeftCols([]);
        setRightCols([]);
        setError(err instanceof Error ? err.message : 'The columns did not load.');
      });
    return () => {
      cancelled = true;
    };
  }, [leftId, rightId]);

  const leftFile = files.find(file => datasetRowId(file) === leftId);
  const rightFile = files.find(file => datasetRowId(file) === rightId);
  const leftName = leftFile?.original_filename || 'First file';
  const rightName = rightFile?.original_filename || 'Second file';
  const rows = leftCols && rightCols ? compareWaves(leftCols, rightCols, leftName, rightName) : [];
  const counts = waveCounts(rows);
  const visible = showAll ? rows : rows.filter(row => row.kind !== 'matched');
  const ready = leftCols !== null && rightCols !== null;

  const setDecision = (id: string, decision: Decision['decision'], target = '') => {
    setChoices(current => ({ ...current, [id]: { decision, target } }));
  };

  const stack = () => {
    if (!leftId || !rightId || leftId === rightId || busy) return;
    setBusy(true);
    setError(null);
    const mappings = stackMappings(rows, choices);
    void flowJson(`/api/projects/${projectId}/wave-maps`, {
      method: 'POST',
      body: JSON.stringify({ sources: [leftId, rightId], mappings }),
    })
      .then(() =>
        flowJson<{ dataset_id?: string; derived_dataset_id?: string }>(
          '/datasets/intake/fuse-datasets',
          {
            method: 'POST',
            body: JSON.stringify({
              dataset_ids: [leftId, rightId],
              wave_names: [leftName, rightName],
              mappings,
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

  const otherNames = (row: WaveDiff) => {
    const names = row.left === EMPTY ? leftCols || [] : rightCols || [];
    return names.map(column => column.name).filter(Boolean);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Stack {leftName} + {rightName}
        </DialogTitle>
        <DialogDescription>
          Columns with the same name stack together. Check the ones that do not.
        </DialogDescription>
      </DialogHeader>
      {files.length > 2 ? (
        <div className="stack-picks">
          <ChoiceSelect
            aria-label="First file"
            value={leftId}
            onValueChange={setLeftId}
            options={files.map(file => ({
              value: datasetRowId(file),
              label: file.original_filename || datasetRowId(file),
            }))}
          />
          <ChoiceSelect
            aria-label="Second file"
            value={rightId}
            onValueChange={setRightId}
            options={files.map(file => ({
              value: datasetRowId(file),
              label: file.original_filename || datasetRowId(file),
            }))}
          />
        </div>
      ) : null}
      {files.length < 2 ? (
        <p className="flow-muted">Add another file before stacking.</p>
      ) : !ready ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="stack-counts">
            <Badge tone="active">{counts.matched} matched</Badge>
            <Badge tone="warn">{counts.check} to check</Badge>
            <Badge>
              {counts.fresh} new in {rightName}
            </Badge>
          </div>
          {visible.length ? (
            <Table className="stack-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{leftName}</TableHead>
                  <TableHead>{rightName}</TableHead>
                  <TableHead>Why it is flagged</TableHead>
                  <TableHead>Do this</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(row => {
                  const choice = choices[row.id] || { decision: 'accept' as const, target: '' };
                  const oneSided = row.left === EMPTY || row.right === EMPTY;
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
                            oneSided
                              ? [
                                  { value: 'accept', label: 'Add' },
                                  { value: 'skip', label: 'Skip' },
                                  { value: 'override', label: 'Treat as same' },
                                ]
                              : [
                                  { value: 'accept', label: 'Stack together' },
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
                            options={otherNames(row).map(name => ({ value: name, label: name }))}
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
          <Button
            className="flow-btn"
            type="button"
            onClick={() => setShowAll(current => !current)}
          >
            {showAll ? 'Show exceptions' : `Show all ${rows.length} mappings`}
          </Button>
        </>
      )}
      {error ? <p className="flow-error">{error}</p> : null}
      <div className="stack-foot">
        <p className="flow-muted">Creates a new dataset. The original files stay as they are.</p>
        <Button className="flow-btn" type="button" onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="sources-ink"
          type="button"
          disabled={busy || files.length < 2 || leftId === rightId}
          onClick={stack}
        >
          {busy ? 'Stacking…' : 'Stack waves'}
        </Button>
      </div>
    </>
  );
}
