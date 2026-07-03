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
      const datasetId = resolveCollaborationDatasetId(datasetIdParam, session);
      if (!datasetId) {
        setPhase('error');
        setErrorMessage(
          'Joined the session, but it is not linked to a dataset. Ask the host to start a new session from the dataset workspace.'
        );
        return;
      }

      const name = datasetNameParam?.trim() || session.fileName?.trim() || 'Dataset';

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

  useEffect(() => {
    if (phase !== 'connecting' || !wsReady) {
      return;
    }
    const session = currentSession?.id === sessionId ? currentSession : pendingSessionRef.current;
    if (!session) {
      return;
    }
    redirectToWorkspace(session);
  }, [phase, wsReady, currentSession, sessionId, redirectToWorkspace]);

  if (!isAuthReady || !isAuthenticated || phase === 'idle' || phase === 'joining') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loading />
        <p className="text-sm text-muted-foreground">
          {phase === 'joining' ? 'Joining session…' : 'Preparing…'}
        </p>
      </div>
    );
  }

  if (phase === 'connecting' || phase === 'redirecting') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loading />
        <p className="text-sm text-muted-foreground">
          {phase === 'redirecting' ? 'Opening workspace…' : 'Connecting to session…'}
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center mx-auto">
        <h1 className="text-lg font-medium">Could not join session</h1>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={() => {
              joinAttempted.current = false;
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
