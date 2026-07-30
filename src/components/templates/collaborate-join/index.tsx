'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Loading from '@/components/molecules/loading';
import { Button } from '@/components/atoms/button';
import { useAuth } from '@/hooks/api/use-auth';
import { useSession, wsService } from '@/hooks/ui/use-session';
import { resolveCollaborationDatasetId } from '@/lib/collaboration-url';

type JoinPhase = 'idle' | 'joining' | 'connecting' | 'redirecting' | 'error';

/** How long to wait for the realtime socket before opening the workspace anyway. */
const WS_CONNECT_GRACE_MS = 2500;

export function CollaborateJoin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session')?.trim() ?? '';
  const datasetIdParam = searchParams.get('datasetId');
  const datasetNameParam = searchParams.get('name');

  const { isAuthenticated, isAuthReady, user } = useAuth();
  const { joinSession, wsReady, currentSession } = useSession();

  const [phase, setPhase] = useState<JoinPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const joinAttempted = useRef(false);
  const redirected = useRef(false);
  const pendingSessionRef = useRef<{
    filePath?: string;
    fileName?: string;
    datasetId?: string;
  } | null>(null);

  const displayName =
    user?.email?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    wsService.userName;

  const redirectToWorkspace = useCallback(
    (session: { filePath?: string; fileName?: string; datasetId?: string }) => {
      if (redirected.current) {
        return;
      }

      const datasetId = resolveCollaborationDatasetId(datasetIdParam, session);
      if (!datasetId) {
        setPhase('error');
        setErrorMessage(
          'Joined the session, but it is not linked to a dataset. Ask the host to start a new session from the dataset workspace.'
        );
        return;
      }

      const name = datasetNameParam?.trim() || session.fileName?.trim() || 'Dataset';

      redirected.current = true;
      setPhase('redirecting');
      router.replace(
        `/workspace/dataset/${encodeURIComponent(datasetId)}?${new URLSearchParams({
          name,
        }).toString()}`
      );
    },
    [datasetIdParam, datasetNameParam, router]
  );

  const runJoin = useCallback(async () => {
    if (!sessionId) {
      setPhase('error');
      setErrorMessage('Missing session id. Use a collaboration link from the host.');
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    setPhase('joining');
    setErrorMessage(null);
    redirected.current = false;

    if (displayName) {
      wsService.userName = displayName;
    }

    try {
      if (currentSession?.id === sessionId && wsReady) {
        redirectToWorkspace(currentSession);
        return;
      }

      const session = await joinSession(sessionId, { userName: displayName });
      pendingSessionRef.current = session;
      setPhase('connecting');
    } catch (err) {
      joinAttempted.current = false;
      setPhase('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not join the collaboration session.'
      );
    }
  }, [
    sessionId,
    isAuthenticated,
    displayName,
    currentSession?.id,
    wsReady,
    joinSession,
    redirectToWorkspace,
    currentSession,
  ]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }
    if (!isAuthenticated) {
      const returnPath =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/workspace/collaborate';
      router.replace(`/login?returnTo=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (!sessionId) {
      setPhase('error');
      setErrorMessage('Missing session id. Use a collaboration link from the host.');
      return;
    }
    if (joinAttempted.current) {
      return;
    }
    joinAttempted.current = true;
    void runJoin();
  }, [isAuthReady, isAuthenticated, sessionId, router, runJoin]);

  // After REST join succeeds, enter the workspace once the socket is ready — or after a
  // short grace period if the handshake fails (e.g. API Gateway 502). Presence can reconnect
  // in the workspace; blocking forever left users stuck on "Connecting to session…".
  useEffect(() => {
    if (phase !== 'connecting') {
      return;
    }
    const session = currentSession?.id === sessionId ? currentSession : pendingSessionRef.current;
    if (!session) {
      return;
    }
    if (wsReady) {
      redirectToWorkspace(session);
      return;
    }
    const timer = window.setTimeout(() => {
      redirectToWorkspace(session);
    }, WS_CONNECT_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, wsReady, currentSession, sessionId, redirectToWorkspace]);

  if (!isAuthReady || !isAuthenticated || phase === 'idle' || phase === 'joining') {
    return <Loading fullScreen message={phase === 'joining' ? 'Joining session…' : 'Preparing…'} />;
  }

  if (phase === 'connecting' || phase === 'redirecting') {
    return (
      <Loading
        fullScreen
        message={phase === 'redirecting' ? 'Opening workspace…' : 'Connecting to session…'}
      />
    );
  }

  if (phase === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex min-h-dvh w-full flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h1 className="text-lg font-medium">Could not join session</h1>
        <p className="max-w-md text-sm text-muted-foreground">{errorMessage}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={() => {
              joinAttempted.current = false;
              redirected.current = false;
              void runJoin();
            }}
          >
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <Loading fullScreen />;
}
