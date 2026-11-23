'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { DropdownMenuItem, Skeleton } from '@/components/ui/rest';
import { Textarea } from '@/components/ui/textarea';
import { datasetRowId, WeightPanel } from '@/components/flow/survey-screens';
import { moveDatasetToProject } from '@/components/flow/move-dataset';
import { StackWaves } from '@/components/flow/stack-waves';
import { JoinFiles } from '@/components/flow/join-files';
import { DatasetMenu } from '@/components/flow/dataset-actions';
import { ACCEPTED_UPLOAD_ACCEPT, isAcceptedUploadExtension } from '@/lib/accepted-upload-types';
import { exportDatasetFormat, exportDatasetSavAndSps, exportStem } from '@/lib/dataset-data-export';
import { flowJson, type FlowProject } from '@/lib/flow-api';
import {
  applyUploadPrep,
  pendingUploadPrep,
  skipUploadPrep,
  uploadDatasetFile,
} from '@/lib/upload-dataset';
import { UploadPrepCard } from '@/components/flow/upload-prep-card';
import type { PrepProposal } from '@/components/flow/upload-prep';
import { ResponseQualityPanel } from '@/components/flow/response-quality-panel';
import { ConnectQualtricsDialog } from '@/components/flow/connect-qualtrics-dialog';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import { showDatasetVersionUndoToast, useDatasetVersion } from '@/lib/dataset-version-undo';

export type SourceFile = {
  dataset_id?: string;
  id?: string;
  original_filename?: string;
  n_rows?: number;
  project_id?: string;
  parent_dataset_id?: string | null;
  lineage_label?: string | null;
  producing_operation?: string | null;
  source_filenames?: string[] | null;
  origin_dataset_id?: string | null;
  offer_switch_back?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  survey_connector?: {
    platform?: string;
    label?: string;
    survey_name?: string;
    last_pulled_at?: string;
  } | null;
};

/** Newest version first. The list is every version of one upload, not only the latest edit. */
export function orderedVersionGroup(files: SourceFile[]): SourceFile[] {
  return [...files].sort((left, right) =>
    String(right.updated_at || right.created_at || '').localeCompare(
      String(left.updated_at || left.created_at || '')
    )
  );
}

/**
 * Files on the project, plus a working version saved without a project id when its
 * parent or origin is already on the project. Matches the API `files_in_project` rule.
 */
export function filesInProject(rows: SourceFile[], projectId: string): SourceFile[] {
  const project = String(projectId || '');
  const chosen = rows.filter(row => String(row.project_id || '') === project && project);
  const ids = new Set(chosen.map(row => datasetRowId(row)).filter(Boolean));
  let pending = true;
  let guard = 0;
  while (pending && guard < 8) {
    guard += 1;
    pending = false;
    for (const row of rows) {
      if (!['', project].includes(String(row.project_id || ''))) continue;
      const rowId = datasetRowId(row);
      if (!rowId || ids.has(rowId)) continue;
      const parent = String(row.parent_dataset_id || '');
      const origin = String(row.origin_dataset_id || '');
      if (ids.has(parent) || ids.has(origin)) {
        chosen.push(row);
        ids.add(rowId);
        pending = true;
      }
    }
  }
  return chosen;
}

export type ContextDoc = {
  id: string;
  name: string;
  kind?: string;
  excerpt?: string;
};

const CONTEXT_KINDS = [
  { value: 'brief', label: 'Brief' },
  { value: 'questionnaire', label: 'Questionnaire' },
  { value: 'report', label: 'Report' },
];

const FILE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeFileId(value: string): boolean {
  const text = value.trim();
  const stem = text.replace(/\.[^.]+$/, '');
  return FILE_UUID.test(text) || FILE_UUID.test(stem);
}

const FILE_NAME_KEY = 'tensr.openingFile';

export function rememberFileName(id: string, name: string): void {
  if (!id || !name || looksLikeFileId(name) || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${FILE_NAME_KEY}:${id}`, name);
  } catch {
    // The picker can still use the name once the file list arrives.
  }
}

export function rememberedFileName(id: string): string {
  if (!id || typeof window === 'undefined') return '';
  try {
    const name = window.sessionStorage.getItem(`${FILE_NAME_KEY}:${id}`) || '';
    return name && !looksLikeFileId(name) ? name : '';
  } catch {
    return '';
  }
}

export function sourceFileName(file: SourceFile): string {
  const names = [file.original_filename, ...(file.source_filenames || [])];
  for (const name of names) {
    const text = String(name || '').trim();
    if (text && !looksLikeFileId(text)) return text;
  }
  if (file.lineage_label && !looksLikeFileId(file.lineage_label)) return file.lineage_label;
  return 'Untitled file';
}

const VERSION_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function versionWhen(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${date.getDate()} ${VERSION_MONTHS[date.getMonth()]} ${hours}:${minutes}:${seconds}`;
}

/** Stack-style working-copy names like "cars_EN + DE + FR". */
function looksLikeStackName(name: string): boolean {
  return / \+ /.test(name);
}

export function sourceVersionTitle(file: SourceFile): string {
  if (!file.parent_dataset_id) return sourceFileName(file);
  const original = String(file.original_filename || '').trim();
  const label = String(file.lineage_label || '').trim();
  let base = '';
  let fromOperationLabel = false;
  // Prefer the operation label ("Raked to region") so two same-day copies stay distinct
  // by what was done. Keep stack-style file names ("cars_EN + DE + FR").
  if (original && !looksLikeFileId(original) && looksLikeStackName(original)) {
    base = original;
  } else if (label && !looksLikeFileId(label)) {
    base = label;
    fromOperationLabel = true;
  } else if (original && !looksLikeFileId(original)) {
    base = original;
  } else {
    base = sourceFileName(file);
  }
  if (!base) base = 'Untitled file';
  // Operation labels stay sentence case ("Raked to region"); file-style names keep their case.
  const titled = fromOperationLabel ? base.charAt(0).toUpperCase() + base.slice(1) : base;
  if (/\d{1,2}:\d{2}/.test(titled)) return titled;
  const stamp = versionWhen(file.created_at || file.updated_at);
  return stamp ? `${titled} · ${stamp}` : titled;
}

/** Newest tip per lineage group, then every older version in one shared fold. */
export function workingVersionSections(versions: SourceFile[]): {
  tips: SourceFile[];
  older: SourceFile[];
  tipIdFor: (file: SourceFile) => string;
} {
  const lineageGroups = new Map<string, SourceFile[]>();
  for (const file of versions) {
    const key = file.origin_dataset_id || file.parent_dataset_id || datasetRowId(file);
    const group = lineageGroups.get(key) || [];
    group.push(file);
    lineageGroups.set(key, group);
  }
  const tips: SourceFile[] = [];
  const older: SourceFile[] = [];
  const tipByOlderId = new Map<string, string>();
  for (const group of lineageGroups.values()) {
    const ordered = orderedVersionGroup(group);
    const newest = ordered[0];
    if (!newest) continue;
    const tipId = datasetRowId(newest);
    tips.push(newest);
    for (const file of ordered.slice(1)) {
      older.push(file);
      tipByOlderId.set(datasetRowId(file), tipId);
    }
  }
  return {
    tips: orderedVersionGroup(tips),
    older: orderedVersionGroup(older),
    tipIdFor: file => tipByOlderId.get(datasetRowId(file)) || datasetRowId(file),
  };
}

/** A stacked parent listed by name: open it when the file is in the library, else say why not. */
export function resolveStackedSource(
  name: string,
  datasets: SourceFile[]
): { file: SourceFile | null; note: string } {
  const needle = name.trim().toLowerCase();
  if (!needle) return { file: null, note: 'Used in a stacked file' };
  const match =
    datasets.find(row => {
      if (row.parent_dataset_id) return false;
      return sourceFileName(row).trim().toLowerCase() === needle;
    }) || null;
  if (match) return { file: match, note: 'Used in a stacked file' };
  return { file: null, note: 'Used in a stacked file · not on this project' };
}

export function sourceFileNote(file: SourceFile): string {
  if (file.parent_dataset_id) return file.lineage_label || 'New version';
  const connector = file.survey_connector;
  if (connector?.label) return connector.label;
  if (connector?.platform === 'qualtrics' || file.producing_operation === 'qualtrics_pull') {
    return (
      file.lineage_label ||
      (connector?.survey_name ? `Qualtrics · ${connector.survey_name}` : 'Qualtrics')
    );
  }
  return 'Raw upload';
}

export function sourceRowCount(file: SourceFile): string {
  return file.n_rows ? `${file.n_rows.toLocaleString('en-GB')} rows` : 'No rows';
}

export function fileMark(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'csv' || ext === 'tsv') return ext.toUpperCase();
  if (ext === 'xlsx' || ext === 'xls') return 'XLS';
  if (ext === 'parquet') return 'PQ';
  if (ext === 'zsav') return 'SAV';
  if (['sav', 'dta', 'sss', 'json'].includes(ext)) return ext.toUpperCase();
  return 'FILE';
}

export function contextMark(kind?: string): string {
  const value = (kind || '').toLowerCase();
  if (value === 'questionnaire' || value === 'pdf') return 'PDF';
  if (value === 'report' || value === 'ppt') return 'PPT';
  return 'DOC';
}

export function SourcesScreen({
  project,
  datasets,
  onChanged,
  projectNames = {},
}: {
  project?: FlowProject;
  datasets: SourceFile[];
  onChanged: () => void;
  projectNames?: Record<string, string>;
}) {
  const router = useRouter();
  const projectId = project?.id || '';
  const files = filesInProject(datasets, projectId).filter(row => datasetRowId(row));
  const fileInput = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<ContextDoc[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [stackOpen, setStackOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docKind, setDocKind] = useState('brief');
  const [docText, setDocText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [olderOpen, setOlderOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectMode, setConnectMode] = useState<'qualtrics' | 'request'>('qualtrics');
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ id: string; prep: PrepProposal } | null>(null);
  const activeId = project?.active_dataset_id || '';
  const skippedPrep = useRef<Set<string>>(new Set());
  const activeBeforeStack = useRef(activeId);
  const activeFile = files.find(row => datasetRowId(row) === activeId);

  useEffect(() => {
    if (!activeId || proposal || skippedPrep.current.has(activeId)) return;
    const bearer = getStytchBearerForTensrApi();
    if (!bearer) return;
    let cancelled = false;
    void pendingUploadPrep(activeId, bearer).then(prep => {
      if (!cancelled && prep) setProposal({ id: activeId, prep: prep as PrepProposal });
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, proposal]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setDocs(null);
    void flowJson<{ docs?: ContextDoc[] }>(`/api/projects/${projectId}/context-docs`)
      .then(page => {
        if (!cancelled) setDocs(page.docs || []);
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const openFile = (id: string, name = '', stay = false) => {
    setError(null);
    rememberFileName(id, name);
    void flowJson(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active_dataset_id: id }),
    })
      .then(() => {
        onChanged();
        if (!stay) router.push(`/flow/p/${projectId}/responses`);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The file did not open.'));
  };

  const useThisVersion = (file: SourceFile, tipId?: string) => {
    const id = datasetRowId(file);
    if (!id || !projectId) return;
    setError(null);
    rememberFileName(id, sourceFileName(file));
    void useDatasetVersion({
      projectId,
      versionId: id,
      tipDatasetId: tipId || activeId || id,
    })
      .then(() => onChanged())
      .catch(err =>
        setError(err instanceof Error ? err.message : 'That version was not restored.')
      );
  };

  const upload = (file: File) => {
    if (!isAcceptedUploadExtension(file.name)) {
      setError('Use a .sav, .zsav, .dta, CSV, TSV, Excel, Triple-S, or Parquet file.');
      return;
    }
    const token = getStytchBearerForTensrApi();
    if (!token) {
      setError('Sign in again to upload a file.');
      return;
    }
    setUploading(true);
    setError(null);
    void uploadDatasetFile(file, token, 'workspace')
      .then(result => {
        const prep = result.prep;
        if (prep && typeof prep === 'object') {
          setProposal({ id: result.dataset_id, prep: prep as PrepProposal });
        }
        return moveDatasetToProject(projectId, result.dataset_id);
      })
      .then(() => onChanged())
      .catch(err => setError(err instanceof Error ? err.message : 'The file did not upload.'))
      .finally(() => setUploading(false));
  };

  const saveDoc = () => {
    const text = docText.trim();
    if (!text) {
      setError('Write the document before saving.');
      return;
    }
    setError(null);
    void flowJson(`/api/projects/${projectId}/context-docs`, {
      method: 'POST',
      body: JSON.stringify({
        name: docName.trim() || 'Document',
        text,
        kind: docKind,
      }),
    })
      .then(() => flowJson<{ docs?: ContextDoc[] }>(`/api/projects/${projectId}/context-docs`))
      .then(page => {
        setDocs(page.docs || []);
        setDocName('');
        setDocText('');
        setAddOpen(false);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The document did not save.'));
  };

  if (docs === null) {
    return (
      <section className="sources-page">
        <div className="sources-wrap">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </section>
    );
  }

  const uploads = files.filter(file => !file.parent_dataset_id);
  const versions = files.filter(file => file.parent_dataset_id);
  const uploadNames = new Set(uploads.map(sourceFileName));
  const fusedNames = versions
    .flatMap(file => file.source_filenames || [])
    .map(name => name.trim())
    .filter(name => name && !uploadNames.has(name))
    .filter((name, index, all) => all.indexOf(name) === index);
  const { tips: versionTips, older: olderVersions, tipIdFor } = workingVersionSections(versions);
  const versionNote = (file: SourceFile) => {
    const label = sourceFileNote(file);
    // Strip a trailing " · 5 Nov 15:42:01" so the note does not repeat the title stamp.
    const plain =
      label.replace(/\s·\s+\d{1,2}\s+\w{3}\s+\d{2}:\d{2}(?::\d{2})?\s*$/, '').trim() || label;
    const made = plain.charAt(0).toUpperCase() + plain.slice(1);
    const sources = (file.source_filenames || []).map(name => name.trim()).filter(Boolean);
    if (sources.length) return `${made} from ${sources.join(', ')}`;
    const parent = datasets.find(row => datasetRowId(row) === file.parent_dataset_id);
    return parent ? `${made} from ${sourceFileName(parent)}` : made;
  };
  const exportFile = (file: SourceFile, action: () => Promise<void>) => {
    setError('');
    void action().catch(err =>
      setError(err instanceof Error ? err.message : 'The download did not start.')
    );
  };

  const fileRow = (file: SourceFile, note: string, action: ReactNode) => {
    const id = datasetRowId(file);
    const inUse = id === project?.active_dataset_id;
    const stem = exportStem(sourceFileName(file));
    return (
      <div key={id} className="sources-dataset" data-active={inUse}>
        <span className="sources-kind">{fileMark(sourceFileName(file))}</span>
        <span>
          <span className="sources-file-name">{sourceVersionTitle(file)}</span>
          <span className="flow-muted">{note}</span>
        </span>
        <span className="flow-muted sources-rows">{sourceRowCount(file)}</span>
        {inUse ? <span className="sources-in-use">In use</span> : null}
        {action}
        <DatasetMenu datasetId={id} name={sourceFileName(file)} inUse={inUse} onChanged={onChanged}>
          <DropdownMenuItem
            onSelect={() => exportFile(file, () => exportDatasetSavAndSps(id, stem))}
          >
            Export as SPSS (.sav + .sps)
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => exportFile(file, () => exportDatasetFormat(id, stem, 'csv'))}
          >
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => exportFile(file, () => exportDatasetFormat(id, stem, 'dta'))}
          >
            Export as Stata (.dta)
          </DropdownMenuItem>
        </DatasetMenu>
      </div>
    );
  };

  if (qualityOpen && activeId) {
    return (
      <section className="sources-page">
        <div className="sources-wrap sources-wrap-wide">
          <ResponseQualityPanel
            datasetId={activeId}
            projectName={project?.name || ''}
            fileLabel={activeFile ? sourceFileName(activeFile) : rememberedFileName(activeId)}
            completes={activeFile?.n_rows}
            onClose={() => setQualityOpen(false)}
            onUploadNewer={() => fileInput.current?.click()}
            onApplied={nextId => {
              setQualityOpen(false);
              if (!projectId || !nextId) {
                onChanged();
                return;
              }
              void flowJson(`/api/projects/${projectId}`, {
                method: 'PATCH',
                body: JSON.stringify({ active_dataset_id: nextId }),
              }).then(() => {
                showDatasetVersionUndoToast({
                  projectId,
                  previousDatasetId: activeId,
                  currentDatasetId: nextId,
                  title: 'Quality-cleaned as a new version',
                  onRestored: () => onChanged(),
                });
                onChanged();
              });
            }}
          />
          <Input
            ref={fileInput}
            className="sources-file-input"
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
      </section>
    );
  }

  return (
    <section className="sources-page">
      <div className="sources-wrap">
        <div className="sources-head">
          <div>
            <h1 className="sources-title">Sources</h1>
            <p className="flow-muted sources-lede">
              Everything this project works from: your files, the versions Tensr made from them, and
              the documents the agent reads.
            </p>
          </div>
          <span className="sources-actions">
            <Button
              className="flow-btn"
              type="button"
              disabled={uploading}
              onClick={() => {
                setConnectMode('qualtrics');
                setConnectOpen(true);
              }}
            >
              Connect Qualtrics
            </Button>
            <Button
              className="sources-ink"
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? 'Uploading…' : '+ Upload file'}
            </Button>
          </span>
        </div>
        {proposal ? (
          <UploadPrepCard
            proposal={proposal.prep}
            fileName={(() => {
              const match = files.find(row => datasetRowId(row) === proposal.id);
              return match ? sourceFileName(match) : rememberedFileName(proposal.id);
            })()}
            onApply={kept => {
              const bearer = getStytchBearerForTensrApi();
              if (!bearer) {
                setError('Sign in again to prepare the file.');
                return;
              }
              void applyUploadPrep(proposal.id, bearer, kept)
                .then(saved =>
                  moveDatasetToProject(projectId, saved.dataset_id).then(() => saved.dataset_id)
                )
                .then(async datasetId => {
                  await flowJson(`/api/projects/${projectId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ active_dataset_id: datasetId }),
                  });
                  setProposal(null);
                  onChanged();
                })
                .catch(err =>
                  setError(err instanceof Error ? err.message : 'The file was not prepared.')
                );
            }}
            onSkip={() => {
              skippedPrep.current.add(proposal.id);
              const bearer = getStytchBearerForTensrApi();
              if (bearer) void skipUploadPrep(proposal.id, bearer);
              setProposal(null);
            }}
          />
        ) : null}

        <div className="sources-block">
          <div className="sources-block-head">
            <h2>Your data</h2>
            <p className="flow-muted">
              Files you uploaded. Open one to analyse it; the agent and Tables use the file in use.
            </p>
          </div>
          {uploads.length || fusedNames.length ? (
            <div className="sources-datasets">
              {uploads.map(file =>
                fileRow(
                  file,
                  file.survey_connector ? sourceFileNote(file) : 'Uploaded',
                  <Button
                    className="flow-btn"
                    type="button"
                    onClick={() =>
                      openFile(
                        datasetRowId(file),
                        sourceFileName(file),
                        Boolean(file.offer_switch_back)
                      )
                    }
                  >
                    {file.offer_switch_back ? 'Switch back' : 'Open'}
                  </Button>
                )
              )}
              {fusedNames.map(name => {
                const resolved = resolveStackedSource(name, datasets);
                const match = resolved.file;
                const matchId = match ? datasetRowId(match) : '';
                return (
                  <div key={name} className="sources-dataset">
                    <span className="sources-kind">{fileMark(name)}</span>
                    <span>
                      <span className="sources-file-name">{name}</span>
                      <span className="flow-muted">{resolved.note}</span>
                    </span>
                    {matchId ? (
                      <Button
                        className="flow-btn"
                        type="button"
                        onClick={() => openFile(matchId, name, Boolean(match?.offer_switch_back))}
                      >
                        Open
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <Button
              className="sources-drop"
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <strong>{uploading ? 'Uploading…' : 'Upload your first file'}</strong>
              <span className="flow-muted">.sav .zsav .dta CSV TSV Excel Triple-S Parquet</span>
            </Button>
          )}
          <Input
            ref={fileInput}
            className="sources-file-input"
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

        <div className="sources-block">
          <div className="sources-block-head">
            <h2>Working versions</h2>
            <p className="flow-muted">
              Stacked, weighted or coded copies Tensr made. Export any as .sav with an .sps weight
              file. Your uploads stay unchanged.
            </p>
            {files.length >= 1 ? (
              <span className="sources-actions">
                {activeId ? (
                  <>
                    <Button className="flow-btn" type="button" onClick={() => setQualityOpen(true)}>
                      Response quality
                    </Button>
                    <Button
                      className="flow-btn"
                      type="button"
                      onClick={() => {
                        activeBeforeStack.current = activeId;
                        setWeightOpen(true);
                      }}
                    >
                      Weight this file
                    </Button>
                  </>
                ) : null}
                {files.length >= 2 ? (
                  <>
                    <Button
                      className="flow-btn"
                      type="button"
                      onClick={() => {
                        activeBeforeStack.current = activeId;
                        setJoinOpen(true);
                      }}
                    >
                      Join files
                    </Button>
                    <Button
                      className="flow-btn"
                      type="button"
                      onClick={() => {
                        activeBeforeStack.current = activeId;
                        setStackOpen(true);
                      }}
                    >
                      Stack files
                    </Button>
                  </>
                ) : null}
              </span>
            ) : null}
          </div>
          {versionTips.length ? (
            <div className="sources-datasets">
              {versionTips.map(newest =>
                fileRow(
                  newest,
                  versionNote(newest),
                  <span className="sources-actions">
                    {/stack|merge|join|fuse/i.test(sourceFileNote(newest)) ? (
                      <Button className="flow-btn" type="button" onClick={() => setStackOpen(true)}>
                        Review mapping
                      </Button>
                    ) : null}
                    {datasetRowId(newest) === activeId ? null : (
                      <Button
                        className="flow-btn"
                        type="button"
                        onClick={() => useThisVersion(newest, datasetRowId(newest))}
                      >
                        Use this version
                      </Button>
                    )}
                    <Button
                      className="flow-btn"
                      type="button"
                      onClick={() => openFile(datasetRowId(newest), sourceFileName(newest))}
                    >
                      Open
                    </Button>
                  </span>
                )
              )}
              {olderVersions.length ? (
                <>
                  <Button
                    className="flow-btn"
                    type="button"
                    aria-expanded={olderOpen}
                    onClick={() => setOlderOpen(open => !open)}
                  >
                    Older versions
                  </Button>
                  {olderOpen
                    ? olderVersions.map(file =>
                        fileRow(
                          file,
                          versionNote(file),
                          <span className="sources-actions">
                            {datasetRowId(file) === activeId ? null : (
                              <Button
                                className="flow-btn"
                                type="button"
                                onClick={() => useThisVersion(file, tipIdFor(file))}
                              >
                                Use this version
                              </Button>
                            )}
                            <Button
                              className="flow-btn"
                              type="button"
                              onClick={() => openFile(datasetRowId(file), sourceFileName(file))}
                            >
                              Open
                            </Button>
                          </span>
                        )
                      )
                    : null}
                </>
              ) : null}
            </div>
          ) : (
            <p className="flow-muted sources-none">
              None yet. Stacking waves, weighting or coding open ends creates one here.
            </p>
          )}
        </div>

        <div className="sources-block">
          <div className="sources-block-head">
            <h2>Context for the agent</h2>
            <p className="flow-muted">
              Questionnaires, briefs and past reports. The agent reads them; they aren&apos;t
              analysed as data.
            </p>
          </div>
          <div className="sources-docs">
            {docs.map(doc => (
              <div key={doc.id} className="sources-doc">
                <span className="sources-kind">{contextMark(doc.kind)}</span>
                <span>
                  <span className="sources-file-name">{doc.name}</span>
                  <span className="flow-muted">{doc.excerpt || doc.kind || 'Context'}</span>
                </span>
              </div>
            ))}
            <Button className="sources-add" type="button" onClick={() => setAddOpen(true)}>
              + Add document
            </Button>
          </div>
        </div>

        {error ? <p className="flow-error">{error}</p> : null}

        <div className="sources-soon-row">
          <Button
            type="button"
            className="sources-soon-chip sources-soon-action"
            onClick={() => {
              setConnectMode('qualtrics');
              setConnectOpen(true);
            }}
          >
            Qualtrics
          </Button>
          <span className="flow-muted">Coming soon</span>
          {['Prolific fielding', 'SurveyMonkey', 'Forsta / Decipher', 'Alchemer'].map(label => (
            <span key={label} className="sources-soon-chip" data-soon>
              {label}
            </span>
          ))}
          <Button
            type="button"
            className="sources-soon-more"
            onClick={() => {
              setConnectMode('request');
              setConnectOpen(true);
            }}
          >
            Request another connector →
          </Button>
          <Link className="sources-soon-more" href="/flow/plugins">
            More in Plugins →
          </Link>
        </div>
      </div>

      <ConnectQualtricsDialog
        key={connectMode}
        open={connectOpen}
        onOpenChange={setConnectOpen}
        initialMode={connectMode}
        onPulled={async result => {
          setError(null);
          if (result.prep && typeof result.prep === 'object') {
            setProposal({ id: result.dataset_id, prep: result.prep as PrepProposal });
          }
          await moveDatasetToProject(projectId, result.dataset_id);
          onChanged();
        }}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add context</DialogTitle>
            <DialogDescription>
              The agent reads this before it answers. It is not analysed as data.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={docName}
            onChange={event => setDocName(event.target.value)}
            aria-label="Document name"
            placeholder="Document name"
          />
          <ChoiceSelect
            aria-label="Document kind"
            value={docKind}
            onValueChange={setDocKind}
            options={CONTEXT_KINDS}
          />
          <Textarea
            value={docText}
            onChange={event => setDocText(event.target.value)}
            aria-label="Document text"
            placeholder="Questionnaire wording, objectives, or a prior report"
          />
          <div className="flow-row">
            <Button className="flow-btn primary" type="button" onClick={saveDoc}>
              Save for the agent
            </Button>
            <Button className="flow-btn" type="button" onClick={() => setAddOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={stackOpen} onOpenChange={setStackOpen}>
        <DialogContent className="sources-stack-dialog">
          <StackWaves
            projectId={projectId}
            datasets={datasets}
            projectNames={projectNames}
            onChanged={onChanged}
            onStacked={nextId => {
              showDatasetVersionUndoToast({
                projectId,
                previousDatasetId: activeBeforeStack.current,
                currentDatasetId: nextId,
                title: 'Stacked as a new file',
                onRestored: () => onChanged(),
              });
            }}
            onDone={() => setStackOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sources-stack-dialog">
          <JoinFiles
            projectId={projectId}
            datasets={datasets}
            activeDatasetId={activeId}
            onChanged={onChanged}
            onDone={() => setJoinOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {weightOpen && activeId ? (
        <WeightPanel
          datasetId={activeId}
          datasets={files}
          onClose={() => setWeightOpen(false)}
          onAdopted={nextId => {
            setWeightOpen(false);
            if (!projectId || !nextId) {
              onChanged();
              return;
            }
            void flowJson(`/api/projects/${projectId}`, {
              method: 'PATCH',
              body: JSON.stringify({ active_dataset_id: nextId }),
            }).then(() => {
              showDatasetVersionUndoToast({
                projectId,
                previousDatasetId: activeBeforeStack.current,
                currentDatasetId: nextId,
                title: 'Weighted as a new version',
                onRestored: () => onChanged(),
              });
              onChanged();
            });
          }}
        />
      ) : null}
    </section>
  );
}
