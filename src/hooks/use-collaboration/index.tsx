import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
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
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [collaborationState, setCollaborationState] = useState<CollaborationState | null>(null);

  // Initialize the collaboration state without connecting
  useEffect(() => {
    // Create an empty awareness object that will be properly initialized when connecting
    const dummyProvider = {
      awareness: {
        getStates: () => new Map(),
        getLocalState: () => null,
        setLocalState: () => {},
        on: () => {},
        off: () => {},
        clientID: 0,
      },
    };

    setCollaborationState({
      users: new Map(),
      doc: ydoc,
      provider: null,
      // Initialize with a dummy awareness object that has the necessary methods
      awareness: dummyProvider.awareness,
      connect: (sessionId, userId, userName) => {
        // Get the WebSocket URL from your environment
        const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || '';
        if (!wsUrl) {
          console.error('WebSocket URL is not configured');
          return null;
        }

        // Create connection with session ID and auth token
        const authToken = getIdToken() || '';
        console.log(
          '[Collaboration] ID Token:',
          authToken ? `${authToken.substring(0, 20)}...` : 'null'
        );
        const wsUrlWithParams = `${wsUrl}?sessionId=${sessionId}&userId=${userId}&token=${authToken}`;
        console.log(
          '[Collaboration] WebSocket URL:',
          wsUrlWithParams.replace(authToken, '***TOKEN***')
        );

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

        // Return the awareness object so it can be used immediately
        return awareness;
      },
      disconnect: () => {
        if (provider) {
          provider.disconnect();
          // Don't destroy the doc, just disconnect
          setProvider(null);
          setCollaborationState(prev => ({
            ...prev!,
            provider: null,
            // Reset to dummy awareness to prevent null errors
            awareness: dummyProvider.awareness,
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
