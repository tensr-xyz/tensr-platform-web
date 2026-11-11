'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SidePanel } from '@/components/flow/side-panel';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChoiceSelect } from '@/components/ui/select';
import { Table } from '@/components/ui/table';
import { Switch } from '@/components/ui/rest';
import { flowJson } from '@/lib/flow-api';
import { analysisDisplayName } from '@/lib/analysis-definitions';
import { clearPin, savePin, useProjectPins } from '@/components/flow/report-pins';
import { ExportDialog, copyText, figureSvg } from '@/components/flow/export-dialog';
import { documentApa, runDocument, type ReportPin } from '@/components/flow/run-document';
import { AnalysisReportView } from '@/components/organisms/analysis-report-view';
import type { AnalysisReport } from '@/lib/analysis-report-types';

function storedReport(run: Record<string, unknown>): AnalysisReport | null {
  const report = run.report;
  if (!report || typeof report !== 'object') return null;
  const record = report as AnalysisReport;
  if (!record.meta || typeof record.meta.title !== 'string' || !Array.isArray(record.tables)) {
    return null;
  }
  return record;
}

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
  const fullReport = useMemo(() => storedReport(run), [run]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [commentError, setCommentError] = useState('');
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rerunNote, setRerunNote] = useState('');
  const [panel, setPanel] = useState<'info' | 'comments'>('info');
  const pins = useProjectPins(projectId, datasetId ? [datasetId] : []);
  const pinned = pins.some(pin => pin.runId === runId);
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

  const pin = pins.find(item => item.runId === runId);
  const kind =
    (
      {
        anova_oneway: 'ANOVA · Compare means',
        banner_table: 'Crosstab',
        descriptives: 'Descriptives',
        chi_square: 'Chi-square',
      } as Record<string, string>
    )[document.op] || analysisDisplayName(document.op);
  const [answer, ...rest] = document.summary.split(/(?<=[.!?])\s+/);
  const when = document.createdAt
    ? new Date(document.createdAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="output-page">
      <div className="output-toolbar">
        <div className="output-crumbs">
          <Button className="output-crumb" type="button" onClick={onBack}>
            ‹ Report
          </Button>
          <span>/</span>
          <Button className="output-crumb" type="button" onClick={onBack}>
            Outputs
          </Button>
          <span>/</span>
          <strong>{document.title}</strong>
        </div>
        <div className="output-actions">
          <Button className="flow-btn" type="button" onClick={rerun}>
            ↻ Rerun
          </Button>
          <Button className="flow-btn" type="button" asChild>
            <Link href={`/flow/p/${projectId}/chat`}>Ask agent</Link>
          </Button>
          <Button
            className="flow-btn"
            type="button"
            data-active={panel === 'comments'}
            onClick={() => setPanel(current => (current === 'comments' ? 'info' : 'comments'))}
          >
            Comments{open.length ? ` · ${open.length}` : ''}
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
          <Button
            className="flow-btn primary output-export-btn"
            type="button"
            onClick={() => setExporting(true)}
          >
            Export <span>PDF · CSV · Markdown · DOCX</span>
          </Button>
        </div>
      </div>
      <div className="output-body">
        <article className="output-doc">
          <div className="output-badges">
            <span className="output-badge-kind">{kind}</span>
            <span className="output-badge-saved">Saved</span>
            {pinned ? <span className="output-badge-in">In report</span> : null}
          </div>
          {fullReport ? null : (
            <>
              <h1>{document.title}</h1>
              <p className="output-meta">
                {[when, document.base != null ? `n = ${document.base}` : '']
                  .filter(Boolean)
                  .join('  |  ')}
              </p>
            </>
          )}
          {fullReport ? (
            <AnalysisReportView
              report={fullReport}
              rawResult={
                run.result && typeof run.result === 'object'
                  ? (run.result as Record<string, unknown>)
                  : null
              }
              provenance={
                run.provenance && typeof run.provenance === 'object'
                  ? (run.provenance as Record<string, unknown>)
                  : null
              }
              datasetId={datasetId}
              analysisRunId={runId}
            />
          ) : null}
          {document.summary && !fullReport ? (
            <div className="output-answer">
              <span>Answer</span>
              <p className="output-answer-lead">{answer}</p>
              {rest.length ? <p className="output-answer-rest">{rest.join(' ')}</p> : null}
            </div>
          ) : fullReport ? null : (
            <p className="flow-muted">This run has no stored summary.</p>
          )}
          {fullReport
            ? null
            : document.tables
                .filter(table => !/syntax/i.test(table.title))
                .map((table, index) => (
                  <section key={table.title} className="output-section">
                    <div className="output-section-head">
                      <h2>{table.title}</h2>
                    </div>
                    <div className={index === 0 && plot ? 'output-split' : undefined}>
                      <Table className="flow-table output-grid">
                        <thead>
                          <tr>
                            {table.columns.map(column => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map(row => (
                            <tr key={row.join('|')}>
                              {row.map((cell, cellIndex) => (
                                <td key={`${cell}-${cellIndex}`}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      {index === 0 && plot ? (
                        <div className="output-plot" dangerouslySetInnerHTML={{ __html: plot }} />
                      ) : null}
                    </div>
                  </section>
                ))}
          {document.checks.length ? (
            <section className="output-section">
              <h2>Checks</h2>
              <div className="output-checks">
                {document.checks.map(check => (
                  <span key={check}>{check}</span>
                ))}
              </div>
            </section>
          ) : null}
          {rerunNote ? <p className="flow-muted">{rerunNote}</p> : null}
        </article>
        {panel === 'info' ? (
          <SidePanel id="output-info" defaultWidth={260} className="output-side">
            <div className="output-card">
              <span className="output-card-label">Used in</span>
              {pin ? (
                <div className="output-used">
                  <strong>Report · Key findings</strong>
                  <span>{pin.headline}</span>
                </div>
              ) : (
                <p className="flow-muted">Not in the report yet.</p>
              )}
            </div>
            <div className="output-card">
              <span className="output-card-label">Versions</span>
              <div className="output-version">
                <i />
                <div>
                  <strong>This run{when ? ` · ${when}` : ''}</strong>
                  <span>{document.base != null ? `n = ${document.base}` : 'Saved run'}</span>
                </div>
                <span className="output-current">Current</span>
              </div>
              <div className="output-auto">
                <div>
                  <strong>Auto-rerun on new waves</strong>
                  <span>Coming soon</span>
                </div>
              </div>
            </div>
            {document.script ? (
              <div className="output-card">
                <div className="output-card-head">
                  <span className="output-card-label">Script</span>
                  <Button
                    className="output-link"
                    type="button"
                    onClick={() => void copyText(document.script)}
                  >
                    Copy
                  </Button>
                </div>
                <pre className="output-script">{document.script}</pre>
                <span className="flow-muted output-script-note">
                  Runs the same in RStudio or a Tensr notebook.
                </span>
              </div>
            ) : null}
            {document.base != null ? (
              <div className="output-card output-traced">Traced to {document.base} respondents</div>
            ) : null}
          </SidePanel>
        ) : (
          <SidePanel id="output-comments" defaultWidth={320} className="output-comments">
            <div className="output-comments-head">
              <strong>Comments</strong>
              <span>{open.length} open</span>
              <Button className="output-link" type="button" onClick={() => setPanel('info')}>
                ×
              </Button>
            </div>
            <div className="output-comments-list">
              {roots.length === 0 ? (
                <p className="flow-muted output-comments-empty">No comments yet.</p>
              ) : null}
              {roots.map(comment => (
                <div
                  key={comment.id}
                  className="output-comment"
                  data-resolved={comment.resolved || undefined}
                >
                  <div className="output-comment-top">
                    <span className="output-avatar">
                      {personName(comment.author_name).slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p>
                        <strong>{personName(comment.author_name)}</strong>{' '}
                        <span className="flow-muted">{commentWhen(comment.created_at)}</span>
                      </p>
                      <p>{comment.text}</p>
                    </div>
                    <Button
                      className="output-resolve"
                      type="button"
                      onClick={() => resolve(comment)}
                    >
                      {comment.resolved ? 'Reopen' : '✓ Resolve'}
                    </Button>
                  </div>
                  {comments
                    .filter(reply => reply.parent_id === comment.id)
                    .map(reply => (
                      <div key={reply.id} className="output-reply">
                        <span className="output-avatar">
                          {personName(reply.author_name).slice(0, 2).toUpperCase()}
                        </span>
                        <p>
                          <strong>{personName(reply.author_name)}</strong>{' '}
                          <span className="flow-muted">{commentWhen(reply.created_at)}</span>
                          <br />
                          {reply.text}
                        </p>
                      </div>
                    ))}
                  <Button
                    className="output-reply-btn"
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
              ))}
            </div>
            <div className="output-compose">
              <Textarea
                aria-label="Comment"
                value={draft}
                placeholder={replyTo ? 'Reply to this comment' : 'Comment on this output'}
                onChange={event => setDraft(event.target.value)}
              />
              <div className="output-compose-row">
                <span className="flow-muted">{replyTo ? 'Replying' : 'On this output'}</span>
                {replyTo ? (
                  <Button className="output-link" type="button" onClick={() => setReplyTo(null)}>
                    Cancel
                  </Button>
                ) : null}
                <Button className="flow-btn primary" type="button" onClick={post}>
                  {replyTo ? 'Reply' : 'Comment'}
                </Button>
              </div>
              {commentError ? <p className="flow-error">{commentError}</p> : null}
            </div>
          </SidePanel>
        )}
      </div>
      {adding ? (
        <AddToReport
          projectId={projectId}
          datasetId={datasetId}
          runId={runId}
          pinned={pinned}
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
  datasetId,
  runId,
  pinned,
  headline,
  support,
  citation,
  findings,
  crosstab,
  onClose,
}: {
  projectId: string;
  datasetId: string;
  runId: string;
  pinned: boolean;
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

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const save = () => {
    const pin: ReportPin = {
      id: `pin-${runId}`,
      runId,
      datasetId,
      headline: title.trim() || headline,
      support: body.trim(),
      citation,
      afterId,
      deck,
      topline,
      keepLive,
    };
    setSaving(true);
    setSaveError('');
    void savePin(projectId, datasetId, pin)
      .then(onClose)
      .catch(err =>
        setSaveError(err instanceof Error ? err.message : 'Could not add to the report')
      )
      .finally(() => setSaving(false));
  };

  const remove = () => {
    setSaving(true);
    setSaveError('');
    void clearPin(projectId, datasetId, runId)
      .then(onClose)
      .catch(err => setSaveError(err instanceof Error ? err.message : 'Could not remove it'))
      .finally(() => setSaving(false));
  };

  const rows: {
    key: string;
    title: string;
    detail: string;
    ext: string;
    checked: boolean;
    set?: (v: boolean) => void;
  }[] = [
    {
      key: 'deck',
      title: 'Client deck',
      detail: 'Adds this finding to the report export the deck is built with',
      ext: '.PPTX',
      checked: deck,
      set: setDeck,
    },
    {
      key: 'topline',
      title: 'Topline summary',
      detail: 'Adds the finding as a plain-English paragraph',
      ext: '.DOCX',
      checked: topline,
      set: setTopline,
    },
    {
      key: 'banner',
      title: 'Banner book',
      detail: crosstab
        ? 'Export the saved table from Tables'
        : 'Not available for this output, banner books hold crosstabs only',
      ext: '.XLSX',
      checked: false,
    },
  ];

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="pin-dialog">
        <DialogHeader className="pin-head">
          <p className="pin-eyebrow">{citation}</p>
          <DialogTitle>Add to report</DialogTitle>
          <DialogDescription className="sr-only">
            Choose where this finding goes and edit its wording.
          </DialogDescription>
        </DialogHeader>
        <div className="pin-body">
          <span className="pin-label">Destination</span>
          <div className="pin-pair">
            <label>
              <span>Report section</span>
              <ChoiceSelect
                aria-label="Report section"
                value="key"
                onValueChange={() => undefined}
                options={[{ value: 'key', label: 'Key findings' }]}
              />
            </label>
            <label>
              <span>Position</span>
              <ChoiceSelect
                aria-label="Position in the report"
                value={afterId}
                onValueChange={setAfterId}
                options={[
                  { value: 'start', label: 'Start' },
                  ...findings.map(finding => ({
                    value: finding.id,
                    label: `After ${finding.label}`,
                  })),
                  { value: 'end', label: 'End' },
                ]}
              />
            </label>
          </div>
          <span className="pin-label">Also add to deliverables</span>
          <div className="pin-list">
            {rows.map(row => (
              <label key={row.key} className="pin-row" data-disabled={!row.set || undefined}>
                <Checkbox
                  checked={row.checked}
                  disabled={!row.set}
                  onCheckedChange={value => row.set?.(value === true)}
                />
                <span className="pin-row-copy">
                  <strong>{row.title}</strong>
                  <span>{row.detail}</span>
                </span>
                <span className="pin-ext">{row.ext}</span>
              </label>
            ))}
          </div>
          <div className="pin-finding-head">
            <span className="pin-label">
              Finding · {String(findings.length + 1).padStart(2, '0')}
            </span>
            <span className="pin-drafted">Drafted from the output, edit freely</span>
          </div>
          <div className="pin-finding">
            <Textarea
              className="pin-headline"
              aria-label="Finding"
              rows={2}
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
            <Textarea
              className="pin-support"
              aria-label="Finding detail"
              rows={2}
              value={body}
              onChange={event => setBody(event.target.value)}
            />
            <div className="pin-chips">
              <span className="pin-chip accent">{citation}</span>
            </div>
          </div>
          <label className="pin-live">
            <span>
              <strong>Keep this finding</strong>
              <span>
                Stays in key findings when they are regenerated. Your edits to the wording are kept.
              </span>
            </span>
            <Switch
              checked={keepLive}
              onCheckedChange={setKeepLive}
              aria-label="Keep this finding"
            />
          </label>
        </div>
        <div className="pin-foot">
          <span className="flow-muted">
            {saveError ? (
              <span className="flow-error">{saveError}</span>
            ) : (
              'The output stays in Outputs too'
            )}
          </span>
          {pinned ? (
            <Button className="flow-btn" type="button" disabled={saving} onClick={remove}>
              Remove from report
            </Button>
          ) : null}
          <Button className="flow-btn" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flow-btn primary" type="button" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : pinned ? 'Update' : 'Add to report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function commentWhen(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function personName(value?: string): string {
  const text = (value || 'Someone').trim();
  return text.includes('@') ? text.split('@')[0] : text;
}
