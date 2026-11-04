'use client';

import './datasets-screen.css';

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceSelect } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { Table } from '@/components/ui/table';
import { DropdownMenuItem, Skeleton } from '@/components/ui/rest';
import { DatasetMenu } from '@/components/flow/dataset-actions';
import { shellDatasetId, type ShellDataset } from '@/components/flow/flow-shell';
import { MoveToProjectDialog } from '@/components/flow/move-dataset';
import { downloadExport } from '@/components/flow/survey-screens';
import { ACCEPTED_UPLOAD_ACCEPT, isAcceptedUploadExtension } from '@/lib/accepted-upload-types';
import { flowJson, type FlowProject } from '@/lib/flow-api';
import { uploadDatasetFile } from '@/lib/upload-dataset';
import { getStytchBearerForTensrApi } from '@/utils/auth';

export type DatasetGroup = {
  /** The upload, or the oldest listed version when its upload is not in the list. */
  root: ShellDataset;
  /** Working versions made from the root, newest first. */
  versions: ShellDataset[];
  /** Latest activity across the root and its versions, in ms. */
  latest: number;
};

function stamp(row: ShellDataset): number {
  const value = new Date(row.updated_at || row.created_at || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

/** The number of uploads: the Datasets header and the sidebar both show this. */
export function uploadTotal(rows: ShellDataset[]): number {
  return groupDatasets(rows).filter(group => !group.root.parent_dataset_id).length;
}

/** Uploads with the working versions whose parent chain leads back to them. */
export function groupDatasets(rows: ShellDataset[]): DatasetGroup[] {
  const listed = rows.filter(row => shellDatasetId(row));
  const byId = new Map(listed.map(row => [shellDatasetId(row), row]));
  const topOf = (row: ShellDataset): ShellDataset => {
    let current = row;
    const seen = new Set([shellDatasetId(row)]);
    while (current.parent_dataset_id) {
      // A parent that is archived or out of scope is not listed; the origin upload still is.
      const parent =
        byId.get(String(current.parent_dataset_id)) ||
        (current.origin_dataset_id ? byId.get(String(current.origin_dataset_id)) : undefined);
      if (!parent || parent === current) break;
      // A parent loop is bad data: show each row on its own rather than guess.
      if (seen.has(shellDatasetId(parent))) return row;
      seen.add(shellDatasetId(parent));
      current = parent;
    }
    return current;
  };
  const groups = new Map<string, DatasetGroup>();
  const order: string[] = [];
  const ensure = (root: ShellDataset) => {
    const id = shellDatasetId(root);
    let group = groups.get(id);
    if (!group) {
      group = { root, versions: [], latest: stamp(root) };
      groups.set(id, group);
      order.push(id);
    }
    return group;
  };
  for (const row of listed) {
    const top = topOf(row);
    const group = ensure(top);
    if (top !== row) {
      group.versions.push(row);
      group.latest = Math.max(group.latest, stamp(row));
    }
  }
  return order
    .map(id => {
      const group = groups.get(id) as DatasetGroup;
      return { ...group, versions: [...group.versions].sort((a, b) => stamp(b) - stamp(a)) };
    })
    .sort((a, b) => b.latest - a.latest);
}

/** "Just now", "12 min ago", "3 h ago", "Yesterday", then "3 Nov" (with the year if not this year). */
export function relativeWhen(iso: string | undefined | null, now: Date = new Date()): string {
  if (!iso) return '—';
  const when = new Date(iso);
  if (!Number.isFinite(when.getTime())) return '—';
  const minutes = Math.floor((now.getTime() - when.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (when.getTime() >= startOfToday) return `${Math.floor(minutes / 60)} h ago`;
  if (when.getTime() >= startOfToday - 86400000) return 'Yesterday';
  return shortDate(when, now);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "3 Nov", or "3 Nov 2025" when it is not this year. Same text in every browser. */
export function shortDate(when: Date, now: Date = new Date()): string {
  const day = `${when.getDate()} ${MONTHS[when.getMonth()]}`;
  return when.getFullYear() === now.getFullYear() ? day : `${day} ${when.getFullYear()}`;
}

/** SAV, CSV, XLSX… from the file name. */
export function fileKind(name?: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name || '');
  return match ? match[1].toUpperCase() : 'FILE';
}

/** The export format closest to the file the person uploaded. */
export function exportFormatFor(name?: string): 'sav' | 'dta' | 'xlsx' | 'csv' {
  const kind = fileKind(name).toLowerCase();
  if (kind === 'sav' || kind === 'zsav') return 'sav';
  if (kind === 'dta') return 'dta';
  if (kind === 'xlsx' || kind === 'xls') return 'xlsx';
  return 'csv';
}

/** "Yesterday" → "yesterday" so it reads inside a sentence. */
export function lowerWhen(label: string): string {
  return label.replace(/^(Yesterday|Just now)/, word => word.toLowerCase());
}

export type DatasetView = 'uploads' | 'versions' | 'all';

/** What the table shows for a view, after project, type and search filters. */
export function visibleGroups(
  groups: DatasetGroup[],
  view: DatasetView,
  match: (row: ShellDataset) => boolean
): { group: DatasetGroup; versions: ShellDataset[]; rootMatches: boolean }[] {
  if (view === 'versions') {
    return groups.flatMap(group =>
      [group.root.parent_dataset_id ? group.root : null, ...group.versions]
        .filter((row): row is ShellDataset => Boolean(row) && match(row as ShellDataset))
        .map(row => ({
          group: { root: row, versions: [], latest: stamp(row) },
          versions: [],
          rootMatches: true,
        }))
    );
  }
  return groups
    .filter(group => view === 'all' || !group.root.parent_dataset_id)
    .map(group => ({
      group,
      versions: group.versions.filter(match),
      rootMatches: match(group.root),
    }))
    .filter(item => item.rootMatches || item.versions.length > 0);
}

const NO_PROJECT = '__none';

export function DatasetsScreen({
  phase,
  datasets,
  projects,
  onChanged,
}: {
  phase: 'loading' | 'ready' | 'error';
  datasets: ShellDataset[];
  projects: FlowProject[];
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [view, setView] = useState<DatasetView | null>(null);
  const [projectFilter, setProjectFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [moving, setMoving] = useState<ShellDataset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});

  const projectById = useMemo(() => new Map(projects.map(item => [item.id, item])), [projects]);
  const projectName = (id?: string) => (id && (projectById.get(id)?.name || names[id])) || '';
  const missing = useMemo(
    () =>
      [...new Set(datasets.map(row => row.project_id).filter(Boolean) as string[])].filter(
        id => !projectById.has(id)
      ),
    [datasets, projectById]
  );
  const missingKey = missing.join('|');
  useEffect(() => {
    if (!missingKey) return;
    void Promise.all(
      missingKey.split('|').map(id =>
        flowJson<{ project?: FlowProject }>(`/api/projects/${id}`)
          .then(page => [id, page.project?.name || ''] as const)
          .catch(() => [id, ''] as const)
      )
    ).then(rows => setNames(current => ({ ...current, ...Object.fromEntries(rows) })));
  }, [missingKey]);

  const groups = useMemo(() => groupDatasets(datasets), [datasets]);
  const uploadCount = groups.filter(group => !group.root.parent_dataset_id).length;
  const versionCount = datasets.filter(row => shellDatasetId(row) && row.parent_dataset_id).length;
  const activeView: DatasetView =
    view ?? (uploadCount > 0 || phase !== 'ready' ? 'uploads' : 'all');

  const kinds = useMemo(
    () => [...new Set(datasets.map(row => fileKind(row.original_filename)))].sort(),
    [datasets]
  );
  const projectOptions = useMemo(() => {
    const ids = [...new Set(datasets.map(row => row.project_id).filter(Boolean) as string[])];
    return ids
      .map(id => ({ value: id, label: projectName(id) || 'Project' }))
      .sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets, projectById, names]);

  const needle = query.trim().toLowerCase();
  const match = (row: ShellDataset) => {
    if (projectFilter === NO_PROJECT && row.project_id) return false;
    if (projectFilter && projectFilter !== NO_PROJECT && row.project_id !== projectFilter)
      return false;
    if (kindFilter && fileKind(row.original_filename) !== kindFilter) return false;
    if (!needle) return true;
    return [row.original_filename, row.lineage_label, projectName(row.project_id)]
      .filter(Boolean)
      .some(text => String(text).toLowerCase().includes(needle));
  };
  const shown = visibleGroups(groups, activeView, match);

  const inUse = (row: ShellDataset) => {
    const project = row.project_id ? projectById.get(row.project_id) : undefined;
    return Boolean(project?.active_dataset_id && project.active_dataset_id === shellDatasetId(row));
  };

  const analyse = (row: ShellDataset) => {
    if (!row.project_id) {
      setMoving(row);
      return;
    }
    setError('');
    void flowJson(`/api/projects/${row.project_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active_dataset_id: shellDatasetId(row) }),
    })
      .then(() => router.push(`/flow/p/${row.project_id}/responses`))
      .catch(err => setError(err instanceof Error ? err.message : 'The file did not open.'));
  };

  const download = (row: ShellDataset) => {
    const format = exportFormatFor(row.original_filename);
    const base = (row.original_filename || 'dataset').replace(/\.[a-z0-9]+$/i, '');
    setError('');
    void downloadExport(
      `/datasets/${shellDatasetId(row)}/export?format=${format}`,
      `${base}.${format}`
    ).catch(err => setError(err instanceof Error ? err.message : 'The download did not start.'));
  };

  const upload = (file: File) => {
    if (!isAcceptedUploadExtension(file.name)) {
      setError('Use a .sav, .dta, CSV, Excel, Triple-S, or Parquet file.');
      return;
    }
    const token = getStytchBearerForTensrApi();
    if (!token) {
      setError('Sign in again to upload a file.');
      return;
    }
    setUploading(true);
    setError('');
    void uploadDatasetFile(file, token, 'workspace')
      .then(() => onChanged())
      .catch(err => setError(err instanceof Error ? err.message : 'The file did not upload.'))
      .finally(() => setUploading(false));
  };

  const menu = (row: ShellDataset) => {
    const id = shellDatasetId(row);
    const name = row.parent_dataset_id
      ? row.lineage_label || row.original_filename || 'Working version'
      : row.original_filename || 'File';
    return (
      <DatasetMenu
        datasetId={id}
        name={row.original_filename || name}
        inUse={inUse(row)}
        onChanged={() => void onChanged()}
      >
        {row.project_id ? (
          <DropdownMenuItem onSelect={() => router.push(`/flow/p/${row.project_id}/sources`)}>
            Open in project
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => analyse(row)}>Analyse in Responses</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setMoving(row)}>Move to project…</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => download(row)}>
          Download as .{exportFormatFor(row.original_filename)}
        </DropdownMenuItem>
      </DatasetMenu>
    );
  };

  const projectCell = (row: ShellDataset) =>
    row.project_id ? (
      <span className="ds-project">
        <span className="ds-dot" aria-hidden />
        {projectName(row.project_id) || 'Project'}
      </span>
    ) : (
      <span className="ds-muted">—</span>
    );

  const count = (value?: number) => (value ? value.toLocaleString('en-GB') : '—');

  return (
    <div className="ds-page">
      <div className="ds-head">
        <div className="ds-titles">
          <div className="ds-eyebrow">Every file in your workspace</div>
          <h1 className="ds-title">Datasets</h1>
        </div>
        <div className="ds-head-actions">
          <Input
            className="ds-search"
            value={query}
            placeholder="Search files or projects"
            aria-label="Search datasets"
            onChange={event => setQuery(event.target.value)}
          />
          <Button
            className="ds-upload"
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Upload file'}
          </Button>
          <Input
            ref={fileInput}
            className="ds-file-input"
            type="file"
            accept={ACCEPTED_UPLOAD_ACCEPT}
            aria-label="Upload file"
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) upload(file);
            }}
          />
        </div>
      </div>

      <div className="ds-filters">
        <Segmented
          className="ds-segment"
          aria-label="Which files"
          value={activeView}
          onValueChange={setView}
          options={[
            { value: 'uploads', label: `Uploads · ${uploadCount}` },
            { value: 'versions', label: `Working versions · ${versionCount}` },
            { value: 'all', label: 'All' },
          ]}
        />
        <ChoiceSelect
          className="ds-select"
          aria-label="Project"
          value={projectFilter}
          onValueChange={setProjectFilter}
          options={[
            { value: '', label: 'All projects' },
            ...projectOptions,
            ...(datasets.some(row => !row.project_id)
              ? [{ value: NO_PROJECT, label: 'Not in a project' }]
              : []),
          ]}
        />
        {kinds.length > 1 ? (
          <ChoiceSelect
            className="ds-select"
            aria-label="File type"
            value={kindFilter}
            onValueChange={setKindFilter}
            options={[
              { value: '', label: 'Any type' },
              ...kinds.map(kind => ({ value: kind, label: kind })),
            ]}
          />
        ) : null}
      </div>

      {error ? <p className="ds-error">{error}</p> : null}

      {phase === 'loading' ? (
        <div className="ds-table-wrap" aria-busy="true">
          <div className="ds-skeleton-head" />
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="ds-skeleton-row">
              <Skeleton className="ds-skeleton-kind" />
              <div className="ds-skeleton-name">
                <Skeleton className="ds-skeleton-line" />
                <Skeleton className="ds-skeleton-line short" />
              </div>
              <Skeleton className="ds-skeleton-cell" />
              <Skeleton className="ds-skeleton-cell small" />
              <Skeleton className="ds-skeleton-cell small" />
              <Skeleton className="ds-skeleton-cell" />
            </div>
          ))}
        </div>
      ) : phase === 'error' ? (
        <div className="ds-empty">
          <strong>We couldn’t load your datasets</strong>
          <span className="ds-muted">Refresh the page to try again.</span>
        </div>
      ) : shown.length === 0 ? (
        <div className="ds-empty">
          <strong>
            {needle || projectFilter || kindFilter
              ? 'No file matches'
              : activeView === 'versions'
                ? 'No working versions yet'
                : 'No datasets yet'}
          </strong>
          <span className="ds-muted">
            {needle || projectFilter || kindFilter
              ? 'Try a different name, project or type.'
              : activeView === 'versions'
                ? 'Stack, weight or code a file in a project and its versions show up here.'
                : 'Upload a .sav, .dta, CSV or Excel file to get started.'}
          </span>
        </div>
      ) : (
        <div className="ds-table-wrap">
          <Table className="ds-table">
            <thead>
              <tr>
                <th className="ds-col-file">File</th>
                <th className="ds-col-project">Project</th>
                <th className="ds-col-num">Rows</th>
                <th className="ds-col-num">Columns</th>
                <th className="ds-col-versions">Versions</th>
                <th className="ds-col-updated">Updated</th>
                <th className="ds-col-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map(({ group, versions, rootMatches }) => {
                const root = group.root;
                const id = shellDatasetId(root);
                const isVersion = Boolean(root.parent_dataset_id);
                const expanded =
                  versions.length > 0 && (open[id] ?? (Boolean(needle) && !rootMatches));
                return (
                  <Fragment key={id}>
                    <tr className="ds-row">
                      <td className="ds-col-file">
                        <div className="ds-file">
                          <span className="ds-kind">{fileKind(root.original_filename)}</span>
                          <div className="ds-file-text">
                            <span className="ds-file-name">
                              {root.original_filename ||
                                (isVersion ? root.lineage_label || 'Working version' : 'File')}
                              {inUse(root) ? <span className="ds-in-use">In use</span> : null}
                            </span>
                            <span className="ds-file-sub">
                              {isVersion
                                ? root.lineage_label || 'Working version'
                                : root.project_id
                                  ? `Uploaded ${lowerWhen(relativeWhen(root.created_at || root.updated_at))}`
                                  : 'Not in a project'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="ds-col-project">{projectCell(root)}</td>
                      <td className="ds-col-num">{count(root.n_rows)}</td>
                      <td className="ds-col-num">{count(root.n_cols)}</td>
                      <td className="ds-col-versions">
                        {group.versions.length > 0 ? (
                          <Button
                            className="ds-toggle"
                            type="button"
                            aria-expanded={expanded}
                            disabled={versions.length === 0}
                            onClick={() => setOpen(current => ({ ...current, [id]: !expanded }))}
                          >
                            {versions.length} version{versions.length === 1 ? '' : 's'}{' '}
                            {expanded ? '⌄' : '›'}
                          </Button>
                        ) : (
                          <span className="ds-muted">{isVersion ? 'Version' : '—'}</span>
                        )}
                      </td>
                      <td className="ds-col-updated ds-muted">
                        {relativeWhen(root.updated_at || root.created_at)}
                      </td>
                      <td className="ds-col-actions">{menu(root)}</td>
                    </tr>
                    {expanded
                      ? versions.map(row => (
                          <tr key={shellDatasetId(row)} className="ds-row ds-child">
                            <td className="ds-col-file">
                              <div className="ds-child-name">
                                <span className="ds-muted" aria-hidden>
                                  ↳
                                </span>
                                <span>
                                  {row.original_filename || row.lineage_label || 'Working version'}
                                </span>
                                {inUse(row) ? <span className="ds-in-use">In use</span> : null}
                              </div>
                            </td>
                            <td className="ds-col-project">
                              {row.project_id && row.project_id !== root.project_id
                                ? projectCell(row)
                                : null}
                            </td>
                            <td className="ds-col-num">{count(row.n_rows)}</td>
                            <td className="ds-col-num">{count(row.n_cols)}</td>
                            <td className="ds-col-versions ds-note">
                              {row.lineage_label || 'Working version'}
                            </td>
                            <td className="ds-col-updated ds-muted">
                              {relativeWhen(row.updated_at || row.created_at)}
                            </td>
                            <td className="ds-col-actions">{menu(row)}</td>
                          </tr>
                        ))
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      <MoveToProjectDialog
        datasetId={moving ? shellDatasetId(moving) : ''}
        datasetName={moving?.original_filename}
        open={Boolean(moving)}
        onOpenChange={next => {
          if (!next) setMoving(null);
        }}
        onMoved={() => void onChanged()}
      />
    </div>
  );
}
