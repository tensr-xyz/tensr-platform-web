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
  role?: string;
  avatar?: string;
}

interface CollaborationState {
  users: Map<string, UserPresence>;
  doc: Y.Doc;
  provider: WebsocketProvider | null;
  awareness: any;
  connect: (sessionId: string, userId: string, userName: string) => void;
  disconnect: () => void;
}

export const useCollaboration = (projectId: string) => {
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [collaborationState, setCollaborationState] = useState<CollaborationState | null>(null);

  // Initialize the collaboration state without connecting
  useEffect(() => {
    setCollaborationState({
      users: new Map(),
      doc: ydoc,
      provider: null,
      awareness: null,
      connect: (sessionId, userId, userName) => {
        // Get the WebSocket URL from your environment
        const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || '';
        if (!wsUrl) {
          console.error('WebSocket URL is not configured');
          return;
        }

        // Create connection with session ID and auth token
        const authToken = localStorage.getItem('token') || '';
        const wsUrlWithParams = `${wsUrl}?sessionId=${sessionId}&userId=${userId}&token=${authToken}`;

        // Create the WebSocket provider
        const newProvider = new WebsocketProvider(wsUrlWithParams, projectId, ydoc);

        // Set up awareness
        const awareness = newProvider.awareness;
        awareness.setLocalState({
          userId,
          userName,
          cursor: null,
          lastActive: Date.now(),
        });

        // Update state with the new provider
        setProvider(newProvider);
        setCollaborationState(prev => ({
          ...prev!,
          provider: newProvider,
          awareness: awareness,
        }));
      },
      disconnect: () => {
        if (provider) {
          provider.disconnect();
          // Don't destroy the doc, just disconnect
          setProvider(null);
          setCollaborationState(prev => ({
            ...prev!,
            provider: null,
          }));
        }
      },
    });

    return () => {
      // Clean up on component unmount
      if (provider) {
        provider.destroy();
      }
      ydoc.destroy();
    };
  }, [projectId, ydoc]);

  return collaborationState;
};
