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
  /** The codes or their labels differ between files, so the column may need recoding. */
  labelsDiffer?: boolean;
  /** Files whose mean sits at the other end of the scale: the scale may run the other way there. */
  scaleFlip?: string[];
  /** The scale's codes, low to high, for Reverse scale when a file has no value labels. */
  scaleCodes?: string[];
};

/** From POST /datasets/intake/scale-check. */
export type ScaleFlag = {
  column: string;
  low: number;
  high: number;
  means: Record<string, number>;
  flip_ids: string[];
};

const formatMean = (value: number) => value.toFixed(1);

/**
 * After the label check: a column whose means sit at opposite ends of the scale across the files
 * goes under "to check", with Recode to match and Reverse scale.
 */
export function applyScaleFlags(
  rows: WaveDiff[],
  flags: ScaleFlag[],
  nameOf: (id: string) => string
): WaveDiff[] {
  const byColumn = new Map(flags.map(flag => [flag.column, flag]));
  return rows.map(row => {
    const column = row.left !== EMPTY ? row.left : row.right;
    const flag = byColumn.get(column);
    if (!flag || row.left === EMPTY || row.right === EMPTY) return row;
    const means = Object.entries(flag.means)
      .map(([id, mean]) => `${nameOf(id)} ${formatMean(mean)}`)
      .join(', ');
    const line = `Means at opposite ends of the ${flag.low}–${flag.high} scale (${means}). The scale may run the other way in ${flag.flip_ids.map(nameOf).join(', ')}`;
    const plain = row.reason === 'Same name' || row.reason === 'In every file';
    const codes: string[] = [];
    for (let code = flag.low; code <= flag.high; code += 1) codes.push(String(code));
    return {
      ...row,
      kind: 'check',
      reason: plain ? line : `${row.reason}. ${line}`,
      labelsDiffer: true,
      scaleFlip: flag.flip_ids,
      scaleCodes: codes,
    };
  });
}

const EMPTY = '—';

const foldLabel = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * How one file's codes and value labels differ from the reference file's, or null when they agree.
 * A translated label counts as a difference: the codes may mean something else in that file.
 */
/** How two files' codes compare for one column. */
export type CodeCompare = {
  /** Codes in the other file that the reference file does not have. */
  extra: string[];
  /** Codes the reference file has that the other file does not. */
  missing: string[];
  /** Same codes, different label text (usually a translation). */
  relabelled: string[];
};

export function compareCodes(reference: WaveColumn, other: WaveColumn): CodeCompare | null {
  const left = reference.value_labels || {};
  const right = other.value_labels || {};
  const a = Object.keys(left);
  const b = Object.keys(right);
  if (!a.length || !b.length) return null;
  return {
    extra: b.filter(key => !(key in left)),
    missing: a.filter(key => !(key in right)),
    relabelled: a.filter(key => key in right && foldLabel(left[key]) !== foldLabel(right[key])),
  };
}

/** A real mismatch: the code lists differ. Translated labels on the same codes are not one. */
export function codesMismatch(compare: CodeCompare | null): boolean {
  return Boolean(compare && (compare.extra.length || compare.missing.length));
}

/** Short per-code diff, e.g. "code 4 (South-East) only in cars_DE". */
export function codeDiffText(
  compare: CodeCompare,
  other: WaveColumn,
  otherName: string,
  referenceName: string
): string {
  const named = (code: string) =>
    other.value_labels?.[code] ? `${code} (${other.value_labels[code]})` : code;
  const parts: string[] = [];
  if (compare.extra.length)
    parts.push(
      `${compare.extra.length === 1 ? 'code' : 'codes'} ${compare.extra
        .slice(0, 3)
        .map(named)
        .join(', ')} only in ${otherName}`
    );
  if (compare.missing.length)
    parts.push(
      `${compare.missing.length === 1 ? 'code' : 'codes'} ${compare.missing
        .slice(0, 3)
        .join(', ')} only in ${referenceName}`
    );
  return parts.join('; ');
}

/** One line: the code mismatch, "labels translated", or null when the codes and labels agree. */
export function labelDifferences(reference: WaveColumn, other: WaveColumn): string | null {
  const compare = compareCodes(reference, other);
  if (!compare) return null;
  if (codesMismatch(compare)) return codeDiffText(compare, other, 'this file', 'the first file');
  return compare.relabelled.length ? 'labels translated' : null;
}

function labelReason(
  left: WaveColumn,
  right: WaveColumn,
  leftName: string,
  rightName: string
): { reason: string; mismatch: boolean } | null {
  const compare = compareCodes(left, right);
  if (!compare) return null;
  if (codesMismatch(compare))
    return { reason: codeDiffText(compare, right, rightName, leftName), mismatch: true };
  return compare.relabelled.length
    ? { reason: 'Same codes · labels translated', mismatch: false }
    : null;
}

/** Every code either file uses, numbers in order. */
export function codeUniverse(...columns: (WaveColumn | undefined)[]): string[] {
  const codes = new Set<string>();
  for (const column of columns)
    for (const key of Object.keys(column?.value_labels || {})) codes.add(key);
  return [...codes].sort((x, y) => {
    const a = Number(x);
    const b = Number(y);
    return Number.isFinite(a) && Number.isFinite(b) ? a - b : x.localeCompare(y);
  });
}

/** 1→5, 2→4 … for a scale that runs the other way in one file. */
export function reversedCodes(codes: string[]): Record<string, string> {
  const numeric = codes.filter(code => Number.isFinite(Number(code)));
  const sorted = [...numeric].sort((a, b) => Number(a) - Number(b));
  if (sorted.length < 2) return {};
  const low = Number(sorted[0]);
  const high = Number(sorted[sorted.length - 1]);
  return Object.fromEntries(sorted.map(code => [code, String(low + high - Number(code))]));
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
    const reason = labelReason(column, other, leftName, rightName);
    rows.push({
      id: `${name}\t${name}`,
      left: name,
      right: name,
      reason: reason?.reason || 'Same name',
      kind: reason?.mismatch ? 'check' : 'matched',
      labelsDiffer: Boolean(reason),
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

type Decision = { decision: 'accept' | 'skip' | 'override' | 'recode'; target: string };

/** Opposite-end means default to Reverse scale (stored as recode), not Stack together. */
export function defaultStackDecision(row: WaveDiff): Decision['decision'] {
  return row.scaleFlip?.length ? 'recode' : 'accept';
}

export function stackMappings(rows: WaveDiff[], choices: Record<string, Decision>) {
  return rows.map(row => {
    const choice = choices[row.id] || {
      decision: defaultStackDecision(row),
      target: '',
    };
    const source = row.left !== EMPTY ? row.left : row.right;
    const target = choice.decision === 'override' ? choice.target || source : source;
    const decision =
      choice.decision === 'recode' || (choice.decision === 'override' && target === source)
        ? 'accept'
        : choice.decision;
    return { source_column: source, target_column: target, decision, note: row.reason };
  });
}

type RecodeMaps = Record<string, Record<string, Record<string, string>>>;

/** {file: {column: {from: to}}} for the rows set to "Recode to match", without codes left as they are. */
export function stackRecodes(
  rows: WaveDiff[],
  choices: Record<string, Decision>,
  maps: RecodeMaps
): Record<string, Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, Record<string, string>>> = {};
  for (const row of rows) {
    if (choices[row.id]?.decision !== 'recode') continue;
    const column = row.left !== EMPTY ? row.left : row.right;
    for (const [fileId, mapping] of Object.entries(maps[row.id] || {})) {
      const changed = Object.fromEntries(
        Object.entries(mapping).filter(([from, to]) => to && from !== to)
      );
      if (!Object.keys(changed).length) continue;
      out[fileId] = { ...(out[fileId] || {}), [column]: changed };
    }
  }
  return out;
}

export type StackFile = MovableDataset & {
  parent_dataset_id?: string | null;
  archived?: boolean;
  n_rows?: number;
  n_cols?: number;
};

/** The same upload listed twice (same name and shape) shows once; the first listed wins. */
export function dedupeUploads(rows: StackFile[]): StackFile[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = `${(row.original_filename || '').toLowerCase()}|${row.n_rows ?? ''}|${row.n_cols ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function columnNameSet(list: WaveColumn[]): Set<string> {
  return new Set(list.map(column => column.name).filter(name => name && !name.startsWith('_')));
}

/** Columns two files share, as a share of the wider file. */
export function sharedColumnShare(left: WaveColumn[], right: WaveColumn[]): number {
  const a = columnNameSet(left);
  const b = columnNameSet(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const name of a) if (b.has(name)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

/** Columns present on every file, against the widest file. */
export function columnOverlap(lists: WaveColumn[][]): {
  matched: number;
  widest: number;
  share: number;
} {
  const sets = lists.map(columnNameSet).filter(set => set.size > 0);
  if (sets.length < 2) return { matched: 0, widest: 0, share: 1 };
  const widest = Math.max(...sets.map(set => set.size));
  let matched = 0;
  for (const name of sets[0]) {
    if (sets.every(set => set.has(name))) matched += 1;
  }
  return { matched, widest, share: widest ? matched / widest : 0 };
}

export const LOW_COLUMN_OVERLAP = 0.5;

/** An upload from another project is offered when at least half the wider file's columns match. */
export function overlapsAny(columns: WaveColumn[], references: WaveColumn[][]): boolean {
  return references.some(reference => sharedColumnShare(columns, reference) >= 0.5);
}

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
    const having = files
      .map(file => ({ file, column: file.columns.find(column => column.name === name) }))
      .filter(item => item.column);
    const reference = having[0]?.column;
    const compared = having.slice(1).map(item => ({
      file: item.file,
      column: item.column!,
      compare: compareCodes(reference!, item.column!),
    }));
    const mismatched = compared.filter(item => codesMismatch(item.compare));
    const translated = compared.filter(
      item => !codesMismatch(item.compare) && item.compare?.relabelled.length
    );
    const reasons: string[] = [];
    if (missing.length) reasons.push(`Not in ${missing.map(file => file.name).join(', ')}`);
    // One line per distinct difference: "code 4 (South-East) only in cars_DE, cars_FR".
    const lines = new Map<string, string[]>();
    for (const item of mismatched) {
      const text = codeDiffText(item.compare!, item.column, '{files}', having[0].file.name);
      lines.set(text, [...(lines.get(text) || []), item.file.name]);
    }
    for (const [text, files] of lines) reasons.push(text.replace('{files}', files.join(', ')));
    if (!reasons.length && translated.length)
      reasons.push(
        `Same codes · labels translated in ${translated.map(item => item.file.name).join(', ')}`
      );
    return {
      id: `${name}\t`,
      left: inFirst ? name : EMPTY,
      right: inFirst ? (missing.length ? EMPTY : name) : name,
      reason: reasons.length ? reasons.join('. ') : 'In every file',
      kind: missing.length ? (inFirst ? 'check' : 'new') : mismatched.length ? 'check' : 'matched',
      labelsDiffer: mismatched.length + translated.length > 0,
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
  const candidates = useMemo(() => stackCandidates(datasets, projectId), [datasets, projectId]);
  const here = useMemo(() => dedupeUploads(candidates.here), [candidates.here]);
  // Projects not on the first page of the project list: look their names up; archived or gone ones are hidden.
  const [projectInfo, setProjectInfo] = useState<Record<string, { name: string; active: boolean }>>(
    {}
  );
  const [lookupsDone, setLookupsDone] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [columnsById, setColumnsById] = useState<Record<string, WaveColumn[]>>({});
  const [choices, setChoices] = useState<Record<string, Decision>>({});
  const [recodeMaps, setRecodeMaps] = useState<RecodeMaps>({});
  const [showAll, setShowAll] = useState(false);
  const [overlap, setOverlap] = useState<{ column: string | null; overlapping_ids: number } | null>(
    null
  );
  const [dedupe, setDedupe] = useState(true);
  const [scaleFlags, setScaleFlags] = useState<ScaleFlag[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLow, setConfirmLow] = useState(false);

  const otherIds = candidates.elsewhere.map(row => datasetRowId(row)).join('|');
  const hereIds = here.map(row => datasetRowId(row)).join('|');
  useEffect(() => {
    let cancelled = false;
    const unknown = [
      ...new Set(
        candidates.elsewhere
          .map(row => row.project_id || '')
          .filter(id => id && !(id in projectNames))
      ),
    ];
    const hereFileIds = here.map(row => datasetRowId(row)).filter(Boolean);
    const otherFileIds = candidates.elsewhere.map(row => datasetRowId(row)).filter(Boolean);
    const fileIds = [...hereFileIds, ...otherFileIds];
    void flowJson<{ columns?: Record<string, string[]> }>('/datasets/intake/column-names', {
      method: 'POST',
      body: JSON.stringify({ dataset_ids: fileIds }),
    })
      .then(page => {
        if (cancelled) return;
        const named = Object.entries(page.columns || {}).map(
          ([id, names]) => [id, names.map(name => ({ name }))] as const
        );
        setColumnsById(current => ({ ...Object.fromEntries(named), ...current }));
        setLookupsDone(true);
      })
      .catch(() => {
        if (!cancelled) setLookupsDone(true);
      });
    void Promise.all(
      unknown.map(id =>
        flowJson<{ project?: { name?: string; status?: string } }>(`/api/projects/${id}`)
          .then(page => [id, page.project] as const)
          .catch(() => [id, undefined] as const)
      )
    ).then(projects => {
      if (cancelled) return;
      setProjectInfo(
        Object.fromEntries(
          projects.map(([id, project]) => [
            id,
            {
              name: project?.name || '',
              active: Boolean(project) && (project?.status || 'active') === 'active',
            },
          ])
        )
      );
    });
    return () => {
      cancelled = true;
    };
    // hereIds/otherIds cover the candidates; projectNames only grows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hereIds, otherIds]);

  const projectLabel = (id?: string | null) =>
    projectNames[id || ''] || projectInfo[id || '']?.name || '';
  const references = (picked.length ? picked : here.map(row => datasetRowId(row)))
    .map(id => columnsById[id])
    .filter((list): list is WaveColumn[] => Boolean(list));
  const elsewhere = dedupeUploads(
    candidates.elsewhere.filter(row => {
      const id = row.project_id || '';
      const known = id in projectNames || projectInfo[id]?.active;
      const columns = columnsById[datasetRowId(row)];
      // A picked file always stays listed so it can be unticked.
      if (picked.includes(datasetRowId(row))) return true;
      // Wait until this project's columns are known, then require column overlap.
      return (
        Boolean(known) &&
        Boolean(columns) &&
        Boolean(references.length) &&
        overlapsAny(columns!, references)
      );
    })
  );
  const otherShown = lookupsDone
    ? elsewhere
    : dedupeUploads(
        candidates.elsewhere.filter(row => {
          const id = row.project_id || '';
          if (projectInfo[id] && !projectInfo[id].active && !(id in projectNames)) return false;
          return true;
        })
      );

  useEffect(() => {
    if (picked.length || here.length < 2) return;
    setPicked(here.map(row => datasetRowId(row)));
  }, [here, picked.length]);

  const pickedKey = picked.join('|');
  const pickedColumns = picked
    .map(id => columnsById[id])
    .filter((list): list is WaveColumn[] => Boolean(list?.length));
  const overlapSummary = columnOverlap(pickedColumns);
  const lowOverlap =
    picked.length >= 2 && overlapSummary.widest > 0 && overlapSummary.share < LOW_COLUMN_OVERLAP;
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
    setConfirmLow(false);
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

  useEffect(() => {
    setScaleFlags([]);
    if (picked.length < 2) return;
    let cancelled = false;
    void flowJson<{ flags?: ScaleFlag[] }>('/datasets/intake/scale-check', {
      method: 'POST',
      body: JSON.stringify({ dataset_ids: picked }),
    })
      .then(result => {
        if (!cancelled) setScaleFlags(result.flags || []);
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
  const labelRows = !ready
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
  const rows = applyScaleFlags(labelRows, scaleFlags, nameOf);
  const counts = waveCounts(rows);
  const visible = showAll ? rows : rows.filter(row => row.kind !== 'matched');
  const scaleKey = rows.map(row => `${row.id}:${(row.scaleFlip || []).join(',')}`).join('|');
  useEffect(() => {
    // Seed reverse-scale defaults so Stack together is never the silent choice for flagged columns.
    const additions: Record<string, Decision> = {};
    const maps: RecodeMaps = {};
    for (const row of rows) {
      if (!row.scaleFlip?.length || choices[row.id]) continue;
      additions[row.id] = { decision: 'recode', target: '' };
      const column = row.left !== EMPTY ? row.left : row.right;
      for (const fileId of row.scaleFlip) {
        const own = (columnsById[fileId] || []).find(item => item.name === column);
        const codes = codeUniverse(own).length ? codeUniverse(own) : row.scaleCodes || [];
        maps[row.id] = {
          ...(maps[row.id] || {}),
          [fileId]: reversedCodes(codes),
        };
      }
    }
    if (!Object.keys(additions).length) return;
    setChoices(current => ({ ...current, ...additions }));
    setRecodeMaps(current => {
      const next = { ...current };
      for (const [rowId, files] of Object.entries(maps)) {
        next[rowId] = { ...(next[rowId] || {}), ...files };
      }
      return next;
    });
    // scaleKey covers flagged rows; choices/maps only grow from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleKey]);
  const toggle = (id: string, on: boolean) =>
    setPicked(current => (on ? [...current, id] : current.filter(item => item !== id)));
  const setDecision = (id: string, decision: Decision['decision'], target = '') =>
    setChoices(current => ({ ...current, [id]: { decision, target } }));
  const columnIn = (fileId: string, name: string) =>
    (columnsById[fileId] || []).find(column => column.name === name);
  /** Files whose codes or labels differ from the first file that has the column. */
  const recodeFiles = (name: string, flipped: string[] = []) => {
    const having = picked.filter(id => columnIn(id, name));
    const reference = having[0] ? columnIn(having[0], name) : undefined;
    return {
      reference,
      others: having
        .slice(1)
        .filter(
          id =>
            flipped.includes(id) || (reference && labelDifferences(reference, columnIn(id, name)!))
        ),
    };
  };
  const setRecode = (rowId: string, fileId: string, mapping: Record<string, string>) =>
    setRecodeMaps(current => ({
      ...current,
      [rowId]: {
        ...(current[rowId] || {}),
        [fileId]: { ...(current[rowId]?.[fileId] || {}), ...mapping },
      },
    }));

  const stack = () => {
    if (picked.length < 2 || clash || busy) return;
    if (lowOverlap && !confirmLow) return;
    setBusy(true);
    setError(null);
    const mappings = stackMappings(rows, choices);
    const recodes = stackRecodes(rows, choices, recodeMaps);
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
              ...(Object.keys(recodes).length ? { recodes } : {}),
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
        {other ? <span className="flow-muted">{projectLabel(row.project_id)}</span> : null}
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
        {otherShown.length ? (
          <>
            <p className="stack-picker-label">Your other projects</p>
            {otherShown.map(row => fileRow(row, true))}
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
      {picked.length >= 2 && overlapSummary.widest > 0 ? (
        <p className={lowOverlap ? 'flow-banner warn' : 'flow-muted'} role="status">
          {overlapSummary.matched} of {overlapSummary.widest} columns match across these files.
          {lowOverlap && !confirmLow ? ' Confirm before stacking files that barely overlap.' : ''}
        </p>
      ) : null}
      {lowOverlap && !confirmLow ? (
        <Button className="flow-btn" type="button" onClick={() => setConfirmLow(true)}>
          Stack anyway
        </Button>
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
                  const choice = choices[row.id] || {
                    decision: defaultStackDecision(row),
                    target: '',
                  };
                  const oneSided = row.left === EMPTY || row.right === EMPTY;
                  const twoFiles = picked.length === 2;
                  const selectValue =
                    choice.decision === 'recode' && row.scaleFlip?.length
                      ? 'reverse'
                      : choice.decision;
                  return (
                    <TableRow key={row.id} data-kind={row.kind}>
                      <TableCell>{row.left}</TableCell>
                      <TableCell>{row.right}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                      <TableCell>
                        <ChoiceSelect
                          aria-label={`Decision for ${row.left} ${row.right}`}
                          value={selectValue}
                          onValueChange={value => {
                            if (value === 'reverse') {
                              // Reverse scale: recode each flagged file 1→5, 2→4 … to match.
                              const column = row.left !== EMPTY ? row.left : row.right;
                              for (const fileId of row.scaleFlip || []) {
                                const own = codeUniverse(columnIn(fileId, column));
                                setRecode(
                                  row.id,
                                  fileId,
                                  reversedCodes(own.length ? own : row.scaleCodes || [])
                                );
                              }
                              setDecision(row.id, 'recode', choice.target);
                              return;
                            }
                            setDecision(row.id, value as Decision['decision'], choice.target);
                          }}
                          options={
                            oneSided && twoFiles
                              ? [
                                  { value: 'accept', label: 'Add' },
                                  { value: 'skip', label: 'Skip' },
                                  { value: 'override', label: 'Treat as same' },
                                ]
                              : [
                                  { value: 'accept', label: oneSided ? 'Add' : 'Stack together' },
                                  ...(row.labelsDiffer
                                    ? [{ value: 'recode', label: 'Recode to match' }]
                                    : []),
                                  ...(row.scaleFlip?.length
                                    ? [{ value: 'reverse', label: 'Reverse scale' }]
                                    : []),
                                  { value: 'skip', label: 'Skip' },
                                ]
                          }
                        />
                        {choice.decision === 'recode'
                          ? (() => {
                              const column = row.left !== EMPTY ? row.left : row.right;
                              const { reference, others } = recodeFiles(column, row.scaleFlip);
                              const targets = codeUniverse(reference).length
                                ? codeUniverse(reference)
                                : row.scaleCodes || [];
                              return others.map(fileId => {
                                const own = columnIn(fileId, column);
                                const codes = codeUniverse(own).length
                                  ? codeUniverse(own)
                                  : row.scaleCodes || [];
                                const mapping = recodeMaps[row.id]?.[fileId] || {};
                                return (
                                  <div key={fileId} className="stack-recode">
                                    <span className="flow-muted">{nameOf(fileId)}</span>
                                    {codes.map(code => (
                                      <span key={code} className="stack-recode">
                                        <span title={own?.value_labels?.[code]}>{code} →</span>
                                        <ChoiceSelect
                                          aria-label={`${nameOf(fileId)} ${column} code ${code} becomes`}
                                          value={mapping[code] || code}
                                          onValueChange={value =>
                                            setRecode(row.id, fileId, { [code]: value })
                                          }
                                          options={[...new Set([...targets, code])].map(target => ({
                                            value: target,
                                            label: reference?.value_labels?.[target]
                                              ? `${target} ${reference.value_labels[target]}`
                                              : target,
                                          }))}
                                        />
                                      </span>
                                    ))}
                                    <Button
                                      className="flow-btn"
                                      type="button"
                                      onClick={() =>
                                        setRecode(row.id, fileId, reversedCodes(codes))
                                      }
                                    >
                                      Reverse scale
                                    </Button>
                                  </div>
                                );
                              });
                            })()
                          : null}
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
          disabled={busy || picked.length < 2 || Boolean(clash) || (lowOverlap && !confirmLow)}
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
