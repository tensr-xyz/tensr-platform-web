import { useEffect, useState } from 'react';
import * as Y from 'yjs';

/**
 * Stub collaboration hook — does NOT open WebSockets.
 *
 * Production collab: `hooks/ui/use-session` + `hooks/ui/use-sheet-state` on
 * RealtimeStack (API Gateway WebSocket + DynamoDB). Fargate / prod `/ws/yjs`
 * are rejected. Local uvicorn Yjs (`app/yjs_ws.py`) is local-dev only and must
 * not be reachable via this hook when `NEXT_PUBLIC_WEBSOCKET_URL` is set.
 *
 * Call sites that only need a local Y.Doc may keep using this; `connect()` is
 * always a no-op so production cannot fall back to a Yjs path by mistake.
 */

export interface UserPresence {
  userId: string;
  userName: string;
  cursor?: {
    x: number;
    y: number;
    tabId?: string;
    element?: string;
  } | null;
  lastActive: number;
  role?: string;
  avatar?: string;
}

interface CollaborationState {
  users: Map<string, UserPresence>;
  doc: Y.Doc;
  provider: null;
  awareness: {
    getStates: () => Map<unknown, unknown>;
    getLocalState: () => null;
    setLocalState: () => void;
    on: () => void;
    off: () => void;
    clientID: number;
  };
  connect: (sessionId: string, userId: string, userName: string) => null;
  disconnect: () => void;
}

export const useCollaboration = (_projectId: string) => {
  const [collaborationState, setCollaborationState] = useState<CollaborationState | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const dummyAwareness = {
      getStates: () => new Map(),
      getLocalState: () => null,
      setLocalState: () => {},
      on: () => {},
      off: () => {},
      clientID: 0,
    };

    const connect = (_sessionId: string, _userId: string, _userName: string) => {
      console.warn(
        '[useCollaboration] connect() is disabled. Use useSession / useSheetState (RealtimeStack).'
      );
      return null;
    };

    setCollaborationState({
      users: new Map(),
      doc: ydoc,
      provider: null,
      awareness: dummyAwareness,
      connect,
      disconnect: () => {},
    });
  }, [_projectId]);

  return collaborationState;
};
