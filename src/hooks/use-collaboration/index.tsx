import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

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
}

interface CollaborationState {
  users: Map<string, UserPresence>;
  doc: Y.Doc;
  provider: WebsocketProvider;
  awareness: any;
}

export const useCollaboration = (projectId: string) => {
  const [collaborationState, setCollaborationState] = useState<CollaborationState | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider('ws://localhost:3000', projectId, ydoc);
    const awareness = provider.awareness;
    const userId = Math.random().toString(36).substr(2, 9);
    const userName = `User ${Math.floor(Math.random() * 1000)}`;

    awareness.setLocalState({
      userId,
      userName,
      cursor: null,
      lastActive: Date.now(),
    });

    setCollaborationState({
      users: new Map(),
      doc: ydoc,
      provider,
      awareness,
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [projectId]);

  return collaborationState;
};
