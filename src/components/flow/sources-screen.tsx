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
import { Skeleton } from '@/components/ui/rest';
import { Textarea } from '@/components/ui/textarea';
import { datasetRowId } from '@/components/flow/survey-screens';
import { moveDatasetToProject } from '@/components/flow/move-dataset';
import { StackWaves } from '@/components/flow/stack-waves';
import { DatasetMenu } from '@/components/flow/dataset-actions';
import { ACCEPTED_UPLOAD_ACCEPT, isAcceptedUploadExtension } from '@/lib/accepted-upload-types';
import { flowJson, type FlowProject } from '@/lib/flow-api';
import { uploadDatasetFile } from '@/lib/upload-dataset';
import { getStytchBearerForTensrApi } from '@/utils/auth';

export type SourceFile = {
  dataset_id?: string;
  id?: string;
  original_filename?: string;
  n_rows?: number;
  project_id?: string;
  parent_dataset_id?: string | null;
  lineage_label?: string | null;
  source_filenames?: string[] | null;
  origin_dataset_id?: string | null;
  offer_switch_back?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

/** Newest version first. The list is every version of one upload, not only the latest edit. */
export function orderedVersionGroup(files: SourceFile[]): SourceFile[] {
  return [...files].sort((left, right) =>
    String(right.updated_at || right.created_at || '').localeCompare(
      String(left.updated_at || left.created_at || '')
    )
  );
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
  return `${date.getDate()} ${VERSION_MONTHS[date.getMonth()]} ${hours}:${minutes}`;
}

export function sourceVersionTitle(file: SourceFile): string {
  const name = sourceFileName(file);
  if (!file.parent_dataset_id || /\d{1,2}:\d{2}/.test(name)) return name;
  const stamp = versionWhen(file.updated_at || file.created_at);
  return stamp ? `${name} · ${stamp}` : name;
}

export function sourceFileNote(file: SourceFile): string {
  if (file.parent_dataset_id) return file.lineage_label || 'Stacked';
  return 'Raw upload';
}

export function sourceRowCount(file: SourceFile): string {
  return file.n_rows ? `${file.n_rows.toLocaleString('en-GB')} rows` : 'No rows';
}

export function fileMark(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'csv') return 'CSV';
  if (ext === 'xlsx' || ext === 'xls') return 'XLS';
  if (ext === 'parquet') return 'PQ';
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
  const files = datasets.filter(row => row.project_id === projectId && datasetRowId(row));
  const fileInput = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<ContextDoc[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [stackOpen, setStackOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docKind, setDocKind] = useState('brief');
  const [docText, setDocText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [olderOpen, setOlderOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

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

  const openFile = (id: string, name = '') => {
    setError(null);
    rememberFileName(id, name);
    void flowJson(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active_dataset_id: id }),
    })
      .then(() => {
        onChanged();
        router.push(`/flow/p/${projectId}/responses`);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'The file did not open.'));
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
    setError(null);
    void uploadDatasetFile(file, token, 'workspace')
      .then(result => moveDatasetToProject(projectId, result.dataset_id))
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
  const lineageGroups = new Map<string, SourceFile[]>();
  for (const file of versions) {
    const key = file.origin_dataset_id || file.parent_dataset_id || datasetRowId(file);
    const group = lineageGroups.get(key) || [];
    group.push(file);
    lineageGroups.set(key, group);
  }
  const versionNote = (file: SourceFile) => {
    const label = sourceFileNote(file);
    const made = label.charAt(0).toUpperCase() + label.slice(1);
    const sources = (file.source_filenames || []).map(name => name.trim()).filter(Boolean);
    if (sources.length) return `${made} from ${sources.join(', ')}`;
    const parent = datasets.find(row => datasetRowId(row) === file.parent_dataset_id);
    return parent ? `${made} from ${sourceFileName(parent)}` : made;
  };
  const fileRow = (file: SourceFile, note: string, action: ReactNode) => {
    const id = datasetRowId(file);
    const inUse = id === project?.active_dataset_id;
    return (
      <div key={id} className="sources-dataset" data-active={inUse}>
        <span className="sources-kind">{fileMark(sourceFileName(file))}</span>
        <span>
          <span className="sources-file-name">{sourceVersionTitle(file)}</span>
          <span className="flow-muted">{note}</span>
        </span>
        <span className="flow-muted sources-rows">{sourceRowCount(file)}</span>
        {inUse ? <span className="sources-in-use">In use</span> : action}
        <DatasetMenu
          datasetId={id}
          name={sourceFileName(file)}
          inUse={inUse}
          onChanged={onChanged}
        />
      </div>
    );
  };

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
          <Button
            className="sources-ink"
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? 'Uploading…' : '+ Upload file'}
          </Button>
        </div>

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
                  'Uploaded',
                  <Button
                    className="flow-btn"
                    type="button"
                    onClick={() => openFile(datasetRowId(file), sourceFileName(file))}
                  >
                    {file.offer_switch_back ? 'Switch back' : 'Open'}
                  </Button>
                )
              )}
              {fusedNames.map(name => (
                <div key={name} className="sources-dataset">
                  <span className="sources-kind">{fileMark(name)}</span>
                  <span>
                    <span className="sources-file-name">{name}</span>
                    <span className="flow-muted">Used in a stacked file</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Button
              className="sources-drop"
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <strong>{uploading ? 'Uploading…' : 'Upload your first file'}</strong>
              <span className="flow-muted">.sav .dta CSV Excel Triple-S Parquet</span>
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
              Stacked, weighted or coded copies Tensr made. Your uploads stay unchanged.
            </p>
            {files.length >= 2 ? (
              <Button className="flow-btn" type="button" onClick={() => setStackOpen(true)}>
                Stack files
              </Button>
            ) : null}
          </div>
          {lineageGroups.size ? (
            <div className="sources-datasets">
              {[...lineageGroups.entries()].map(([key, group]) => {
                const ordered = orderedVersionGroup(group);
                const newest = ordered[0];
                const older = ordered.slice(1);
                const openOlder = Boolean(olderOpen[key]);
                return (
                  <div key={key}>
                    {fileRow(
                      newest,
                      versionNote(newest),
                      <span className="sources-actions">
                        {/stack|merge|join|fuse/i.test(sourceFileNote(newest)) ? (
                          <Button
                            className="flow-btn"
                            type="button"
                            onClick={() => setStackOpen(true)}
                          >
                            Review mapping
                          </Button>
                        ) : null}
                        <Button
                          className="flow-btn"
                          type="button"
                          onClick={() => openFile(datasetRowId(newest), sourceFileName(newest))}
                        >
                          Open
                        </Button>
                      </span>
                    )}
                    {older.length ? (
                      <>
                        <Button
                          className="flow-btn"
                          type="button"
                          aria-expanded={openOlder}
                          onClick={() =>
                            setOlderOpen(current => ({ ...current, [key]: !current[key] }))
                          }
                        >
                          Older versions
                        </Button>
                        {openOlder
                          ? older.map(file =>
                              fileRow(
                                file,
                                versionNote(file),
                                <Button
                                  className="flow-btn"
                                  type="button"
                                  onClick={() => openFile(datasetRowId(file), sourceFileName(file))}
                                >
                                  Open
                                </Button>
                              )
                            )
                          : null}
                      </>
                    ) : null}
                  </div>
                );
              })}
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
          <span className="flow-muted">Coming soon</span>
          {['Prolific fielding', 'Qualtrics sync', 'Decipher / Alchemer'].map(label => (
            <span key={label} className="sources-soon-chip" data-soon>
              {label}
            </span>
          ))}
          <Link className="sources-soon-more" href="/flow/plugins">
            More connectors in Plugins →
          </Link>
        </div>
      </div>

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
            onDone={() => setStackOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
