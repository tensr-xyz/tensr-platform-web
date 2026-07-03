import { useEffect, useRef, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { getTensrWebSocketUrl } from '@/lib/tensr-api-url';
import { getIdToken } from '@/utils/auth';

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
  provider: WebsocketProvider | null;
  awareness: any;
  connect: (sessionId: string, userId: string, userName: string) => any;
  disconnect: () => void;
}

export const useCollaboration = (projectId: string) => {
  const [collaborationState, setCollaborationState] = useState<CollaborationState | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

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

    const disconnect = () => {
      const p = providerRef.current;
      if (p) {
        try {
          p.disconnect();
        } catch {
          /* ignore */
        }
        try {
          p.destroy();
        } catch {
          /* ignore */
        }
        providerRef.current = null;
      }
      setCollaborationState(prev =>
        prev
          ? {
              ...prev,
              provider: null,
              awareness: dummyAwareness,
            }
          : prev
      );
    };

    const connect = (sessionId: string, userId: string, userName: string) => {
      const authToken = getIdToken() || '';
      if (!authToken) {
        console.error('Authentication required for collaboration WebSocket');
        return null;
      }

      disconnect();

      const wsBase =
        process.env.NEXT_PUBLIC_WEBSOCKET_URL?.replace(/\/$/, '') ||
        getTensrWebSocketUrl('/ws/yjs');

      const newProvider = new WebsocketProvider(wsBase, projectId, ydoc, {
        params: {
          sessionId,
          userId,
          token: authToken,
        },
      });

      providerRef.current = newProvider;

      const awareness = newProvider.awareness;
      awareness.setLocalState({
        userId,
        userName,
        cursor: null,
        lastActive: Date.now(),
      });

      setCollaborationState(prev =>
        prev
          ? {
              ...prev,
              provider: newProvider,
              awareness,
            }
          : prev
      );

      return awareness;
    };

    setCollaborationState({
      users: new Map(),
      doc: ydoc,
      provider: null,
      awareness: dummyAwareness,
      connect,
      disconnect,
    });

    return () => {
      disconnect();
      try {
        ydoc.destroy();
      } catch {
        /* ignore */
      }
    };
  }, [projectId]);

  return collaborationState;
};
