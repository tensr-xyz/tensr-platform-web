'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/api/use-auth';
import { useSession, wsService } from '@/hooks/ui/use-session';
import { readPersistedActiveSessionId } from '@/lib/collaboration-session-storage';

/**
 * Ensure the guest/host stay in the collaboration session on the dataset page:
 * - re-join from `?session=` or sessionStorage when the in-memory singleton was lost
 * - re-attach the WebSocket when we already have currentSession but the socket is down
 */
export function SessionRestore() {
  const searchParams = useSearchParams();
  const sessionFromUrl = searchParams.get('session')?.trim() ?? '';
  const { isAuthReady, isAuthenticated, user } = useAuth();
  const { currentSession, joinSession, wsReady } = useSession();
  const joinAttempted = useRef<string | null>(null);
  const socketAttempted = useRef<string | null>(null);

  const targetSessionId =
    sessionFromUrl || currentSession?.id || readPersistedActiveSessionId() || '';

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated || !targetSessionId) {
      return;
    }

    const displayName =
      user?.email?.trim() ||
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
      wsService.userName;

    // Keep ?session= in the address bar when we restored from memory/storage.
    if (!sessionFromUrl && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('session') !== targetSessionId) {
        url.searchParams.set('session', targetSessionId);
        window.history.replaceState({}, '', url.toString());
      }
    }

    if (currentSession?.id === targetSessionId) {
      if (!wsReady && socketAttempted.current !== targetSessionId) {
        socketAttempted.current = targetSessionId;
        wsService.setupWebSocket(targetSessionId);
      }
      return;
    }

    if (joinAttempted.current === targetSessionId) {
      return;
    }
    joinAttempted.current = targetSessionId;

    void joinSession(targetSessionId, { userName: displayName })
      .then(() => {
        socketAttempted.current = targetSessionId;
      })
      .catch(err => {
        console.error('[SessionRestore] failed to rejoin session:', err);
        // Allow a later retry if auth/network recovers.
        joinAttempted.current = null;
      });
    // joinSession is recreated each render; omit it to avoid retrigger loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthReady,
    isAuthenticated,
    targetSessionId,
    sessionFromUrl,
    currentSession?.id,
    wsReady,
    user?.email,
    user?.firstName,
    user?.lastName,
  ]);

  return null;
}
