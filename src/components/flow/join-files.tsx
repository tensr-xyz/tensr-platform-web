'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChoiceSelect } from '@/components/ui/select';
import { datasetRowId } from '@/components/flow/survey-screens';
import { moveDatasetToProject } from '@/components/flow/move-dataset';
import { sourceFileName, type SourceFile } from '@/components/flow/sources-screen';
import { flowJson } from '@/lib/flow-api';
import { mergeDatasets, type MergePreviewResult, type MergeReport } from '@/lib/dataset-data-ops';
import { mergeUnmatchedReportLines } from '@/lib/merge-unmatched-report';
import { pickObviousIdColumn } from '@/lib/obvious-id-column';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { showDatasetVersionUndoToast } from '@/lib/dataset-version-undo';

type JoinColumn = { name: string; label?: string | null };

type JoinHow = 'left' | 'inner';

function columnLabel(column: JoinColumn): string {
  const label = String(column.label || '').trim();
  return label || column.name;
}

/** Match ID columns by label (never by code alone) for the Join files picker. */
export function sharedIdOptions(
  left: JoinColumn[],
  right: JoinColumn[]
): { leftName: string; rightName: string; label: string }[] {
  const rightByLabel = new Map<string, JoinColumn>();
  for (const column of right) {
    const key = columnLabel(column).toLowerCase();
    if (!rightByLabel.has(key)) rightByLabel.set(key, column);
  }
  const options: { leftName: string; rightName: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const column of left) {
    const key = columnLabel(column).toLowerCase();
    const match = rightByLabel.get(key);
    if (!match) continue;
    if (seen.has(column.name)) continue;
    seen.add(column.name);
    const leftLabel = columnLabel(column);
    const rightLabel = columnLabel(match);
    options.push({
      leftName: column.name,
      rightName: match.name,
      label: leftLabel === rightLabel ? leftLabel : `${leftLabel} ↔ ${rightLabel}`,
    });
  }
  return options;
}

export function JoinFiles({
  projectId,
  datasets,
  activeDatasetId,
  onChanged,
  onDone,
}: {
  projectId: string;
  datasets: SourceFile[];
  activeDatasetId?: string | null;
  onChanged: () => void;
  onDone: () => void;
}) {
  const files = datasets.filter(row => Boolean(datasetRowId(row)));
  const [leftId, setLeftId] = useState(activeDatasetId || (files[0] ? datasetRowId(files[0]) : ''));
  const [rightId, setRightId] = useState(files[1] ? datasetRowId(files[1]) : '');
  const [how, setHow] = useState<JoinHow>('left');
  const [keyName, setKeyName] = useState('');
  const [columnsById, setColumnsById] = useState<Record<string, JoinColumn[]>>({});
  const [report, setReport] = useState<MergeReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileOptions = files.map(file => ({
    value: datasetRowId(file),
    label: sourceFileName(file),
  }));

  useEffect(() => {
    const needed = [leftId, rightId].filter(Boolean);
    const missing = needed.filter(id => !columnsById[id]);
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(
      missing.map(id =>
        flowJson<{ columns?: JoinColumn[] }>(`/datasets/${id}/metadata`).then(
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
  }, [leftId, rightId, columnsById]);

  const keyOptions = useMemo(
    () => sharedIdOptions(columnsById[leftId] || [], columnsById[rightId] || []),
    [columnsById, leftId, rightId]
  );

  const selectedKey = keyOptions.find(option => option.leftName === keyName) || null;

  useEffect(() => {
    if (!keyOptions.length) {
      setKeyName('');
      return;
    }
    const obvious = pickObviousIdColumn(keyOptions.map(option => option.leftName));
    setKeyName(current =>
      keyOptions.some(option => option.leftName === current)
        ? current
        : obvious || keyOptions[0]?.leftName || ''
    );
  }, [keyOptions]);

  useEffect(() => {
    setReport(null);
  }, [leftId, rightId, how, keyName]);

  const mergeBody = () => {
    if (!selectedKey) return null;
    const keyMap =
      selectedKey.leftName === selectedKey.rightName
        ? undefined
        : { [selectedKey.leftName]: selectedKey.rightName };
    return {
      secondary_dataset_id: rightId,
      merge_type: how,
      keys: [selectedKey.leftName],
      ...(keyMap ? { key_map: keyMap } : {}),
    };
  };

  const preview = () => {
    const body = mergeBody();
    if (!leftId || !rightId || !body || leftId === rightId) return;
    const token = getStytchBearerForTensrApi();
    setBusy(true);
    setError(null);
    void mergeDatasets(leftId, { ...body, preview: true }, token)
      .then(result => {
        if ((result as MergePreviewResult).preview) {
          setReport((result as MergePreviewResult).merge_report);
          return;
        }
        setReport((result as { merge_report?: MergeReport }).merge_report || null);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The preview did not run.'))
      .finally(() => setBusy(false));
  };

  const join = () => {
    const body = mergeBody();
    if (!leftId || !rightId || !body || leftId === rightId || !report || busy) return;
    const token = getStytchBearerForTensrApi();
    const previous = activeDatasetId || leftId;
    setBusy(true);
    setError(null);
    void mergeDatasets(leftId, body, token)
      .then(result => {
        const nextId =
          ('dataset_id' in result && result.dataset_id) ||
          ('derived_dataset_id' in result && result.derived_dataset_id) ||
          '';
        if (!nextId) throw new Error('The join did not return a dataset.');
        return moveDatasetToProject(projectId, String(nextId)).then(() => String(nextId));
      })
      .then(nextId =>
        flowJson(`/api/projects/${projectId}`, {
          method: 'PATCH',
          body: JSON.stringify({ active_dataset_id: nextId }),
        }).then(() => nextId)
      )
      .then(nextId => {
        showDatasetVersionUndoToast({
          projectId,
          previousDatasetId: previous,
          currentDatasetId: nextId,
          title: 'Joined as a new file',
          onRestored: () => onChanged(),
        });
        onChanged();
        onDone();
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The join did not save.'))
      .finally(() => setBusy(false));
  };

  const canPreview = Boolean(leftId && rightId && keyName && leftId !== rightId);
  const lines = report ? mergeUnmatchedReportLines(report, true) : [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>Join files</DialogTitle>
        <DialogDescription>
          Pick two files and a matching ID column. Preview matched and unmatched counts, then save a
          new copy.
        </DialogDescription>
      </DialogHeader>
      <div className="flow-stack sources-join">
        <ChoiceSelect
          aria-label="First file"
          value={leftId}
          onValueChange={value => {
            setLeftId(value);
            if (value === rightId) setRightId('');
          }}
          options={fileOptions}
        />
        <ChoiceSelect
          aria-label="Second file"
          value={rightId}
          onValueChange={setRightId}
          options={fileOptions.filter(option => option.value !== leftId)}
        />
        <ChoiceSelect
          aria-label="Join type"
          value={how}
          onValueChange={value => setHow(value as JoinHow)}
          options={[
            { value: 'left', label: 'Left join — keep every row in the first file' },
            { value: 'inner', label: 'Inner join — only rows that match' },
          ]}
        />
        <ChoiceSelect
          aria-label="ID column"
          value={keyName}
          onValueChange={setKeyName}
          options={keyOptions.map(option => ({
            value: option.leftName,
            label: option.label,
          }))}
          disabled={!keyOptions.length}
          placeholder={keyOptions.length ? 'ID column' : 'No matching ID column'}
        />
        {error ? <p className="flow-error">{error}</p> : null}
        {lines.length ? (
          <ul className="sources-join-report">
            {lines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <div className="flow-row">
          <Button
            className="flow-btn"
            type="button"
            disabled={!canPreview || busy}
            onClick={preview}
          >
            {busy && !report ? 'Checking…' : 'Show matched counts'}
          </Button>
          <Button
            className="flow-btn primary"
            type="button"
            disabled={!report || busy}
            onClick={join}
          >
            {busy && report ? 'Joining…' : 'Join files'}
          </Button>
          <Button className="flow-btn" type="button" onClick={onDone}>
            Close
          </Button>
        </div>
      </div>
    </>
  );
}
