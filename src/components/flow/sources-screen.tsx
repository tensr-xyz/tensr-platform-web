'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
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
};

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

export function sourceFileName(file: SourceFile): string {
  return file.original_filename || file.dataset_id || file.id || 'File';
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
  stack,
}: {
  project?: FlowProject;
  datasets: SourceFile[];
  onChanged: () => void;
  stack?: ReactNode;
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

  const openFile = (id: string) => {
    setError(null);
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

  return (
    <section className="sources-page">
      <div className="sources-wrap">
        <div className="sources-head">
          <div>
            <h1 className="sources-title">Sources</h1>
            <p className="flow-muted">
              Where this project's data comes from. Tensr reads from your survey and panel tools, it
              doesn't replace them.
            </p>
          </div>
          <Button
            className="sources-ink"
            type="button"
            onClick={() =>
              document.getElementById('sources-connect')?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            + Connect source
          </Button>
        </div>

        <div className="sources-fielding">
          <div>
            <div className="sources-fielding-title">Fielding</div>
            <p className="flow-muted">
              Panel fielding is coming soon. Completes, quotas, and spend show here once a panel is
              connected.
            </p>
          </div>
          <Badge tone="soon">Coming soon</Badge>
        </div>

        <div className="sources-block">
          <h2>Connected</h2>
          {files.length ? (
            <div className="sources-connected">
              {files.map(file => {
                const id = datasetRowId(file);
                return (
                  <div key={id} className="sources-file">
                    <span className="sources-mark">{fileMark(sourceFileName(file))}</span>
                    <span>
                      <span className="sources-file-name">{sourceFileName(file)}</span>
                      <span className="flow-muted">Uploaded · {sourceRowCount(file)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="flow-muted">No files in this project yet.</p>
          )}
        </div>

        <div className="sources-block" id="sources-connect">
          <h2>Connect a source</h2>
          <div className="sources-connectors">
            <div className="sources-connector">
              <span>Prolific</span>
              <span className="flow-muted">Status, quotas, participant IDs</span>
              <Badge tone="soon">Coming soon</Badge>
            </div>
            <div className="sources-connector">
              <span>Qualtrics</span>
              <span className="flow-muted">Live sync responses</span>
              <Badge tone="soon">Coming soon</Badge>
            </div>
            <div className="sources-connector">
              <span>Decipher / Alchemer</span>
              <span className="flow-muted">Import by survey ID</span>
              <Badge tone="soon">Coming soon</Badge>
            </div>
            <Button
              className="sources-connector"
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <span>{uploading ? 'Uploading…' : 'Upload file'}</span>
              <span className="flow-muted">.sav .dta CSV Excel Triple-S Parquet</span>
            </Button>
            <Link className="sources-connector sources-more" href="/flow/plugins">
              <span>More connectors</span>
              <span className="flow-muted">Browse in Plugins</span>
            </Link>
          </div>
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
            <h2>Datasets</h2>
            <p className="flow-muted">
              Join or stack two files, fuse three or more. Export any as .sav with an .sps weight
              file.
            </p>
            {files.length >= 2 ? (
              <Button className="flow-btn" type="button" onClick={() => setStackOpen(true)}>
                Stack files
              </Button>
            ) : null}
          </div>
          {files.length ? (
            <div className="sources-datasets">
              {files.map(file => {
                const id = datasetRowId(file);
                const inUse = id === project?.active_dataset_id;
                return (
                  <div key={id} className="sources-dataset" data-active={inUse}>
                    <i />
                    <span>
                      <span className="sources-file-name">{sourceFileName(file)}</span>
                      <span className="flow-muted">{sourceFileNote(file)}</span>
                    </span>
                    <span className="flow-muted sources-rows">{sourceRowCount(file)}</span>
                    {inUse ? (
                      <span className="sources-in-use">In use</span>
                    ) : file.parent_dataset_id ? (
                      <Button className="flow-btn" type="button" onClick={() => setStackOpen(true)}>
                        Review mapping
                      </Button>
                    ) : (
                      <Button className="flow-btn" type="button" onClick={() => openFile(id)}>
                        Open
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="flow-muted">Upload a file to start a dataset.</p>
          )}
        </div>

        <div className="sources-block">
          <div className="sources-block-head">
            <h2>Context</h2>
            <p className="flow-muted">
              The agent reads these before it answers. They aren't analysed as data.
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
              + Add
            </Button>
          </div>
        </div>
        {error ? <p className="flow-error">{error}</p> : null}
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
          <DialogHeader>
            <DialogTitle>Stack files</DialogTitle>
            <DialogDescription>
              Accept, override, or skip each column. Save runs the fuse and opens the stacked
              dataset.
            </DialogDescription>
          </DialogHeader>
          {stack}
        </DialogContent>
      </Dialog>
    </section>
  );
}
