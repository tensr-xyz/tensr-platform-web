import { useState, useEffect, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface WebSocketState {
  isConnected: boolean;
  clientId: string | null;
}

export function useWebSocket(url: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    clientId: null,
  });

  useEffect(() => {
    const socket = new WebSocket(url);

    socket.onopen = () => {
      setState(prev => ({ ...prev, isConnected: true }));
    };

    socket.onclose = () => {
      setState(prev => ({ ...prev, isConnected: false }));
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [url]);

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
