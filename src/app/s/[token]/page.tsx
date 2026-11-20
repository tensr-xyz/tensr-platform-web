'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/rest';
import { AnalysisReportView } from '@/components/organisms/analysis-report-view';
import { runDocument } from '@/components/flow/run-document';
import { ShareViewerFilters } from '@/components/flow/share-viewer-filters';
import { flowJson } from '@/lib/flow-api';
import {
  fetchPublicShare,
  fetchPublicShareView,
  recalledSharePassword,
  rememberSharePassword,
  savePublicShareView,
  unlockPublicShare,
  type PublicSharePayload,
} from '@/lib/public-share';
import type { AnalysisReport } from '@/lib/analysis-report-types';
import type { PublicViewerControl, SavedViewerView } from '@/lib/share-viewer-controls';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import '../../invite/invite.css';

function storedReport(run: Record<string, unknown>): AnalysisReport | null {
  const report = run.report;
  if (!report || typeof report !== 'object') return null;
  const record = report as AnalysisReport;
  if (!record.meta || typeof record.meta.title !== 'string' || !Array.isArray(record.tables)) {
    return null;
  }
  return record;
}

function viewerControls(payload: PublicSharePayload | null): PublicViewerControl[] {
  const rows = payload?.viewer?.controls;
  return Array.isArray(rows) ? rows : [];
}

function viewerSavedViews(payload: PublicSharePayload | null): SavedViewerView[] {
  const rows = payload?.viewer?.saved_views;
  return Array.isArray(rows) ? (rows as SavedViewerView[]) : [];
}

function shareIsLocked(payload: PublicSharePayload | null): boolean {
  return Boolean(payload?.password_required);
}

/** Shared output or project link. Outside the signed-in shell (Paper has no public board yet). */
export default function PublicSharePage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || '');
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'locked' | 'error' | 'joining'>(
    'loading'
  );
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<PublicSharePayload | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});
  const [filterBusy, setFilterBusy] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (!token) {
      setPhase('error');
      setError('This link is incomplete.');
      return;
    }
    let live = true;
    const remembered = recalledSharePassword(token);
    fetchPublicShare(token, remembered || undefined)
      .then(body => {
        if (!live) return;
        setPayload(body);
        if (shareIsLocked(body)) {
          setPhase('locked');
          return;
        }
        if (remembered) setSharePassword(remembered);
        setPhase('ready');
      })
      .catch(err => {
        if (!live) return;
        setError(err instanceof Error ? err.message : 'This link is no longer valid');
        setPhase('error');
      });
    return () => {
      live = false;
    };
  }, [token]);

  const run = payload?.run;
  const fullReport = useMemo(() => (run ? storedReport(run) : null), [run]);
  const document = useMemo(() => (run ? runDocument(run) : null), [run]);
  const controls = useMemo(() => viewerControls(payload), [payload]);
  const savedViews = useMemo(() => viewerSavedViews(payload), [payload]);

  useEffect(() => {
    if (phase !== 'ready' || !payload || payload.share.kind !== 'project_link') return;
    const projectId = String(payload.project.id || '');
    if (!projectId) return;
    if (!getStytchBearerForTensrApi()) return;
    setPhase('joining');
    void flowJson<{ project_id?: string }>(`/api/public/shares/${encodeURIComponent(token)}/join`, {
      method: 'POST',
      headers: sharePassword ? { 'X-Share-Password': sharePassword } : undefined,
    })
      .then(() => router.replace(`/flow/p/${projectId}/report`))
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Could not open this project');
        setPhase('error');
      });
  }, [phase, payload, token, router, sharePassword]);

  const unlock = () => {
    const password = passwordDraft.trim();
    if (!password) {
      setPasswordError('Enter the password for this link.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError('');
    void unlockPublicShare(token, password)
      .then(body => {
        rememberSharePassword(token, password);
        setSharePassword(password);
        setPayload(body);
        setPhase('ready');
      })
      .catch(err => {
        setPasswordError(err instanceof Error ? err.message : 'That password is not correct');
      })
      .finally(() => setPasswordBusy(false));
  };

  const applyFilters = (next: Record<string, unknown>) => {
    setFilterValues(next);
    setFilterBusy(true);
    setFilterError('');
    void fetchPublicShareView(token, next, sharePassword || undefined)
      .then(body => {
        setPayload(previous =>
          previous
            ? {
                ...previous,
                run: body.run ?? previous.run,
                viewer: body.viewer ?? previous.viewer,
                share: body.share ?? previous.share,
                password_required: false,
              }
            : body
        );
      })
      .catch(err => {
        setFilterError(err instanceof Error ? err.message : 'Could not apply filters');
      })
      .finally(() => setFilterBusy(false));
  };

  const saveView = (name: string, values: Record<string, unknown>) => {
    setFilterBusy(true);
    setFilterError('');
    void savePublicShareView(token, name, values, sharePassword || undefined)
      .then(body => {
        setPayload(previous =>
          previous
            ? {
                ...previous,
                viewer: body.viewer ?? previous.viewer,
                share: body.share ?? previous.share,
              }
            : body
        );
      })
      .catch(err => {
        setFilterError(err instanceof Error ? err.message : 'Could not save that view');
      })
      .finally(() => setFilterBusy(false));
  };

  if (phase === 'loading' || phase === 'joining') {
    return (
      <main className="iv">
        <div className="iv-card share-public-card">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      </main>
    );
  }

  if (phase === 'error' || !payload) {
    return (
      <main className="iv">
        <div className="iv-card">
          <h1 className="iv-title">Link unavailable</h1>
          <p className="iv-body">{error || 'This link is no longer valid.'}</p>
          <Button asChild className="iv-btn">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (phase === 'locked') {
    return (
      <main className="iv">
        <div className="iv-card">
          <h1 className="iv-title">{payload.project.name || 'Shared report'}</h1>
          <p className="iv-body">This published link is password protected.</p>
          <Input
            type="password"
            autoComplete="current-password"
            aria-label="Password"
            placeholder="Password"
            value={passwordDraft}
            onChange={event => setPasswordDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') unlock();
            }}
          />
          {passwordError ? <p className="iv-note flow-error">{passwordError}</p> : null}
          <Button
            className="iv-btn iv-primary"
            type="button"
            disabled={passwordBusy}
            onClick={unlock}
          >
            Open
          </Button>
        </div>
      </main>
    );
  }

  if (payload.share.kind === 'project_link') {
    const projectId = String(payload.project.id || '');
    const loginHref = `/login?${new URLSearchParams({
      returnTo: `/s/${token}`,
    })}`;
    return (
      <main className="iv">
        <div className="iv-card">
          <h1 className="iv-title">{payload.project.name || 'Shared project'}</h1>
          <p className="iv-body">Sign in to open this project as a Viewer.</p>
          <Button asChild className="iv-btn iv-primary">
            <Link href={loginHref}>Sign in</Link>
          </Button>
          {projectId ? (
            <p className="iv-note">
              Already signed in? <Link href={`/flow/p/${projectId}/report`}>Open the report</Link>
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="iv share-public">
      <div className="iv-card share-public-card">
        <p className="iv-note">{payload.project.name || 'Shared output'}</p>
        <h1 className="iv-title">{String(payload.share.title || document?.title || 'Output')}</h1>
        <ShareViewerFilters
          controls={controls}
          savedViews={savedViews}
          values={filterValues}
          busy={filterBusy}
          error={filterError}
          onChange={applyFilters}
          onSaveView={saveView}
          onApplyView={view => applyFilters(view.values || {})}
        />
        {fullReport ? (
          <AnalysisReportView
            report={fullReport}
            rawResult={
              run?.result && typeof run.result === 'object'
                ? (run.result as Record<string, unknown>)
                : null
            }
            datasetId={String(run?.dataset_id || '')}
            analysisRunId={String(run?.id || payload.share.run_id || '')}
          />
        ) : null}
        {!fullReport && document?.summary ? <p>{document.summary}</p> : null}
        {!fullReport
          ? (document?.tables || []).map(table => (
              <section key={table.title} className="output-section">
                <h2>{table.title}</h2>
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
              </section>
            ))
          : null}
        {!fullReport && !document?.tables.length ? (
          <p className="flow-muted">This output has nothing to show.</p>
        ) : null}
      </div>
    </main>
  );
}
