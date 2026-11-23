'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/rest';
import { PublicShareViewer } from '@/components/flow/public-share-viewer';
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
import type { PublicViewerControl, SavedViewerView } from '@/lib/share-viewer-controls';
import { getStytchBearerForTensrApi } from '@/utils/auth';
import '../../invite/invite.css';

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

function isAnonymousViewer(payload: PublicSharePayload | null): boolean {
  if (!payload) return false;
  if (payload.share.kind === 'output') return true;
  if (payload.share.kind === 'project_link') {
    return (
      payload.viewer_mode === 'anonymous' ||
      payload.share.access === 'anonymous' ||
      Boolean(payload.report)
    );
  }
  return false;
}

/** Shared output or project link. Paper 6m public viewer for anonymous links. */
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

  const controls = useMemo(() => viewerControls(payload), [payload]);
  const savedViews = useMemo(() => viewerSavedViews(payload), [payload]);

  useEffect(() => {
    if (phase !== 'ready' || !payload || payload.share.kind !== 'project_link') return;
    if (isAnonymousViewer(payload)) return;
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

  if (isAnonymousViewer(payload)) {
    return (
      <PublicShareViewer
        token={token}
        payload={payload}
        controls={controls}
        savedViews={savedViews}
        filterValues={filterValues}
        filterBusy={filterBusy}
        filterError={filterError}
        onFilterChange={applyFilters}
        onSaveView={saveView}
        onApplyView={view => applyFilters(view.values || {})}
      />
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
    <PublicShareViewer
      token={token}
      payload={payload}
      controls={controls}
      savedViews={savedViews}
      filterValues={filterValues}
      filterBusy={filterBusy}
      filterError={filterError}
      onFilterChange={applyFilters}
      onSaveView={saveView}
      onApplyView={view => applyFilters(view.values || {})}
    />
  );
}
