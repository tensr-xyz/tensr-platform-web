import { useState, useEffect, useCallback } from 'react';
import { getIdToken } from '@/utils/auth';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface WebSocketState {
  isConnected: boolean;
  clientId: string | null;
}

interface UseWebSocketOptions {
  url: string;
  enabled?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(urlOrOptions: string | UseWebSocketOptions) {
  const options =
    typeof urlOrOptions === 'string' ? { url: urlOrOptions, enabled: true } : urlOrOptions;

  const { url, enabled = true, onOpen, onClose, onError } = options;

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    clientId: null,
  });

  useEffect(() => {
    if (!enabled || !url) {
      return;
    }

    // Add auth token to URL if not already present
    let wsUrl = url;
    if (!url.includes('access_token=') && !url.includes('Authorization')) {
      const token = getIdToken();
      if (token) {
        const separator = url.includes('?') ? '&' : '?';
        wsUrl = `${url}${separator}access_token=${token}`;
      }
    }

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setState(prev => ({ ...prev, isConnected: true }));
      onOpen?.();
    };

    socket.onclose = () => {
      setState(prev => ({ ...prev, isConnected: false }));
      onClose?.();
    };

    socket.onerror = error => {
      onError?.(error);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [url, enabled, onOpen, onClose, onError]);

  const sendMessage = useCallback(
    (message: WebSocketMessage) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ ...message, clientId: state.clientId }));
      }
    },
    [ws, state.clientId]
  );

  const subscribe = useCallback(
    (handler: (message: WebSocketMessage) => void) => {
      if (!ws) return () => {};

      const handleMessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          handler(message);
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.addEventListener('message', handleMessage);
      return () => ws.removeEventListener('message', handleMessage);
    },
    [ws]
  );

  return {
    isConnected: state.isConnected,
    clientId: state.clientId,
    sendMessage,
    subscribe,
  };
}
