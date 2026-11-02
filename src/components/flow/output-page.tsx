'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChoiceSelect } from '@/components/ui/select';
import { flowJson } from '@/lib/flow-api';
import { ExportDialog, copyText, figureSvg } from '@/components/flow/export-dialog';
import {
  documentApa,
  readPins,
  runDocument,
  writePins,
  type ReportPin,
} from '@/components/flow/run-document';

type Comment = {
  id: string;
  author_name?: string;
  text?: string;
  created_at?: string;
  parent_id?: string | null;
  resolved?: boolean;
  anchor?: { id?: string } | null;
};

export function OutputPage({
  projectId,
  datasetId,
  runId,
  run,
  findings,
  onBack,
}: {
  projectId: string;
  datasetId: string;
  runId: string;
  run: Record<string, unknown>;
  findings: { id: string; label: string }[];
  onBack: () => void;
}) {
  const document = useMemo(() => runDocument(run), [run]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [commentError, setCommentError] = useState('');
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rerunNote, setRerunNote] = useState('');
  const pinned = readPins(projectId).some(pin => pin.runId === runId);
  const plot = figureSvg(
    document.tables.find(table => table.title === 'Group means') || document.tables[0]
  );

  const loadComments = () => {
    void flowJson<{ comments?: Comment[] }>(
      `/reports/${runId}/comments?dataset_id=${encodeURIComponent(datasetId)}`
    )
      .then(page => setComments(page.comments || []))
      .catch(err =>
        setCommentError(err instanceof Error ? err.message : 'Could not load comments')
      );
  };

  useEffect(() => {
    loadComments();
  }, [datasetId, runId]);

  const post = () => {
    const text = draft.trim();
    if (!text) return;
    setCommentError('');
    void flowJson(`/reports/${runId}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        dataset_id: datasetId,
        parent_id: replyTo || undefined,
        anchor: { kind: 'section', id: document.title },
      }),
    })
      .then(() => {
        setDraft('');
        setReplyTo(null);
        loadComments();
      })
      .catch(err =>
        setCommentError(err instanceof Error ? err.message : 'Could not post the comment')
      );
  };

  const resolve = (comment: Comment) => {
    void flowJson(`/reports/${runId}/comments/${comment.id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolved: !comment.resolved, dataset_id: datasetId }),
    })
      .then(() => loadComments())
      .catch(err =>
        setCommentError(err instanceof Error ? err.message : 'Could not update the comment')
      );
  };

  const rerun = () => {
    setRerunNote('');
    void flowJson(`/datasets/${datasetId}/analysis-runs/${runId}/rerun`, { method: 'POST' })
      .then(() => setRerunNote('Rerun saved as a new analysis. It is in Outputs.'))
      .catch(err => setRerunNote(err instanceof Error ? err.message : 'Could not rerun'));
  };

  const open = comments.filter(comment => !comment.resolved);
  const roots = comments.filter(comment => !comment.parent_id);

  return (
    <div className="output-page">
      <div className="output-toolbar">
        <Button className="flow-btn" type="button" onClick={onBack}>
          Outputs
        </Button>
        <span>{document.title}</span>
        <Button className="flow-btn" type="button" onClick={rerun}>
          Rerun
        </Button>
        <Button className="flow-btn" type="button" asChild>
          <Link href={`/flow/p/${projectId}/chat`}>Ask agent</Link>
        </Button>
        <Button
          className="flow-btn"
          type="button"
          onClick={() => void copyText(documentApa(document))}
        >
          Copy APA 7
        </Button>
        <Button className="flow-btn" type="button" onClick={() => setAdding(true)}>
          {pinned ? 'In report' : 'Add to report'}
        </Button>
        <Button className="flow-btn primary" type="button" onClick={() => setExporting(true)}>
          Export
        </Button>
      </div>
      <div className="output-body">
        <article className="output-doc">
          <p className="flow-muted">
            {document.op.replaceAll('_', ' ')}
            {pinned ? ' · In report' : ''}
          </p>
          <h2>{document.title}</h2>
          <p className="flow-muted">
            {document.base != null ? `Base ${document.base}` : 'Base is not on this run'}
          </p>
          {document.summary ? (
            <p>{document.summary}</p>
          ) : (
            <p className="flow-muted">This run has no stored summary.</p>
          )}
          {document.tables.map(table => (
            <section key={table.title}>
              <h3>{table.title}</h3>
              <div className="output-table">
                <div className="outputs-row">
                  {table.columns.map(column => (
                    <span key={column}>{column}</span>
                  ))}
                </div>
                {table.rows.map(row => (
                  <div key={row.join('|')} className="outputs-row">
                    {row.map((cell, index) => (
                      <span key={`${cell}-${index}`}>{cell}</span>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))}
          {plot ? <div className="output-plot" dangerouslySetInnerHTML={{ __html: plot }} /> : null}
          {document.checks.length ? (
            <section>
              <h3>Checks</h3>
              {document.checks.map(check => (
                <p key={check}>{check}</p>
              ))}
            </section>
          ) : null}
          {document.script ? (
            <section>
              <h3>Script</h3>
              <pre className="output-script">{document.script}</pre>
            </section>
          ) : null}
          {rerunNote ? <p className="flow-muted">{rerunNote}</p> : null}
        </article>
        <aside className="output-comments">
          <p>
            Comments <span className="flow-muted">{open.length} open</span>
          </p>
          {roots.map(comment => (
            <div key={comment.id} className="output-comment">
              <p>
                {comment.author_name || 'Someone'}{' '}
                <span className="flow-muted">{commentWhen(comment.created_at)}</span>
              </p>
              <p>{comment.text}</p>
              <div className="outputs-export">
                <Button className="flow-btn" type="button" onClick={() => resolve(comment)}>
                  {comment.resolved ? 'Reopen' : 'Resolve'}
                </Button>
                <Button
                  className="flow-btn"
                  type="button"
                  onClick={() => {
                    setReplyTo(comment.id);
                    setDraft(current =>
                      current ? current : `@${comment.author_name || 'Someone'} `
                    );
                  }}
                >
                  Reply
                </Button>
              </div>
              {comments
                .filter(reply => reply.parent_id === comment.id)
                .map(reply => (
                  <p key={reply.id} className="output-reply">
                    {reply.author_name || 'Someone'}: {reply.text}
                  </p>
                ))}
            </div>
          ))}
          <Textarea
            aria-label="Comment"
            value={draft}
            placeholder={replyTo ? 'Reply to this comment' : 'Comment on this output'}
            onChange={event => setDraft(event.target.value)}
          />
          <div className="outputs-export">
            {replyTo ? (
              <Button className="flow-btn" type="button" onClick={() => setReplyTo(null)}>
                Cancel reply
              </Button>
            ) : null}
            <Button className="flow-btn primary" type="button" onClick={post}>
              {replyTo ? 'Reply' : 'Comment'}
            </Button>
          </div>
          {commentError ? <p className="flow-error">{commentError}</p> : null}
        </aside>
      </div>
      {adding ? (
        <AddToReport
          projectId={projectId}
          runId={runId}
          headline={document.summary.split(/(?<=[.!?])\s+/)[0] || document.title}
          support={document.summary}
          citation={document.title}
          findings={findings}
          crosstab={/crosstab|banner|frequency/i.test(document.op)}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {exporting ? (
        <ExportDialog
          kind="table"
          title={document.title}
          document={document}
          svg={plot || undefined}
          runIds={[runId]}
          onClose={() => setExporting(false)}
        />
      ) : null}
    </div>
  );
}

function AddToReport({
  projectId,
  runId,
  headline,
  support,
  citation,
  findings,
  crosstab,
  onClose,
}: {
  projectId: string;
  runId: string;
  headline: string;
  support: string;
  citation: string;
  findings: { id: string; label: string }[];
  crosstab: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(headline);
  const [body, setBody] = useState(support);
  const [afterId, setAfterId] = useState(findings.at(-1)?.id || 'end');
  const [deck, setDeck] = useState(true);
  const [topline, setTopline] = useState(true);
  const [keepLive, setKeepLive] = useState(true);

  const save = () => {
    const pin: ReportPin = {
      id: `pin-${runId}`,
      runId,
      headline: title.trim() || headline,
      support: body.trim(),
      citation,
      afterId,
      deck,
      topline,
      keepLive,
    };
    const current = readPins(projectId).filter(item => item.runId !== runId);
    writePins(projectId, [...current, pin]);
    onClose();
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to report</DialogTitle>
          <DialogDescription>{citation}</DialogDescription>
        </DialogHeader>
        <label className="flow-muted">
          Position
          <ChoiceSelect
            aria-label="Position in the report"
            value={afterId}
            onValueChange={setAfterId}
            options={[
              { value: 'start', label: 'Start of key findings' },
              ...findings.map(finding => ({ value: finding.id, label: `After ${finding.label}` })),
              { value: 'end', label: 'End of key findings' },
            ]}
          />
        </label>
        <label className="flow-check">
          <Checkbox checked={deck} onCheckedChange={value => setDeck(value === true)} />
          Client deck. This finding is included in the report export. The PowerPoint deck is still
          built from saved tables.
        </label>
        <label className="flow-check">
          <Checkbox checked={topline} onCheckedChange={value => setTopline(value === true)} />
          Topline. This finding is included in the report export. The Word topline is still the
          first saved table.
        </label>
        <label className="flow-check">
          <Checkbox checked={false} disabled />
          Banner book.{' '}
          {crosstab ? 'Export the saved table from Tables.' : 'This output is not a crosstab.'}
        </label>
        <Textarea
          aria-label="Finding"
          value={title}
          onChange={event => setTitle(event.target.value)}
        />
        <Textarea
          aria-label="Finding detail"
          value={body}
          onChange={event => setBody(event.target.value)}
        />
        <label className="flow-check">
          <Checkbox checked={keepLive} onCheckedChange={value => setKeepLive(value === true)} />
          Keep this finding when key findings are regenerated.
        </label>
        <DialogFooter>
          <Button className="flow-btn" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flow-btn primary" type="button" onClick={save}>
            Add to report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function pinnedFindings(projectId: string) {
  return readPins(projectId);
}

function commentWhen(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
