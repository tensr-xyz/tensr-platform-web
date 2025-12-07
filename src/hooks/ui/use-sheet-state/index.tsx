import { useState, useEffect, useCallback, useRef } from 'react';
import { SheetState, SheetOp, ServerMessage, ClientMessage, ColumnSchema } from '@/types/sheet';
import { useWebSocket } from '../use-websocket';
import { getIdToken } from '@/utils/auth';

interface UseSheetStateOptions {
  sheetId: string;
  enabled?: boolean;
}

interface UseSheetStateReturn {
  state: SheetState | null;
  version: number;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  applyOperation: (op: Omit<SheetOp, 'actor' | 'timestamp'>) => Promise<boolean>;
  requestAI: (prompt: string, channelId: string) => void;
  subscribe: () => void;
  unsubscribe: () => void;
}

export function useSheetState({
  sheetId,
  enabled = true,
}: UseSheetStateOptions): UseSheetStateReturn {
  const [state, setState] = useState<SheetState | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pendingOpsRef = useRef<Map<number, SheetOp>>(new Map());
  const opSequenceRef = useRef<number>(0);

  // Get WebSocket URL from environment or config
  const getWebSocketUrl = useCallback(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Get WebSocket URL from environment or construct from API URL
    const wsBaseUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    if (wsBaseUrl) {
      return `${wsBaseUrl}?sheetId=${sheetId}`;
    }
    // Fallback: construct from API URL
    const apiUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/^https?:\/\//, '') || 'api.tensr.com';
    return `${wsProtocol}//${apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/realtime?sheetId=${sheetId}`;
  }, [sheetId]);

  const {
    isConnected: wsConnected,
    sendMessage,
    subscribe: wsSubscribe,
  } = useWebSocket({
    url: enabled ? getWebSocketUrl() : '',
    enabled,
  });

  useEffect(() => {
    setIsConnected(wsConnected);
  }, [wsConnected]);

  // Apply operation to local state
  const applyOpToState = useCallback((op: SheetOp, currentState: SheetState): SheetState => {
    const newState = { ...currentState };
    let newData = [...newState.data];
    let newColumns = [...newState.columns];

    switch (op.kind) {
      case 'update_cell': {
        if (op.row >= 0 && op.row < newData.length) {
          newData = newData.map((row, idx) =>
            idx === op.row ? { ...row, [op.column]: op.newValue } : row
          );
        }
        break;
      }

      case 'append_rows': {
        newData = [...newData, ...op.rows];
        break;
      }

      case 'delete_row': {
        if (op.row >= 0 && op.row < newData.length) {
          newData = newData.filter((_, idx) => idx !== op.row);
        }
        break;
      }

      case 'insert_row': {
        const insertIndex = Math.min(op.index, newData.length);
        newData = [...newData.slice(0, insertIndex), op.row, ...newData.slice(insertIndex)];
        break;
      }

      case 'rename_column': {
        newColumns = newColumns.map(col => (col === op.oldName ? op.newName : col));
        newData = newData.map(row => {
          const newRow = { ...row };
          if (op.oldName in newRow) {
            newRow[op.newName] = newRow[op.oldName];
            delete newRow[op.oldName];
          }
          return newRow;
        });
        newState.schema = newState.schema.map(col =>
          col.name === op.oldName ? { ...col, name: op.newName } : col
        );
        break;
      }

      case 'add_column': {
        newColumns = [...newColumns, op.name];
        newState.schema = [
          ...newState.schema,
          {
            name: op.name,
            type: op.type as 'string' | 'number' | 'boolean' | 'date',
            nullable: true,
          },
        ];
        newData = newData.map(row => ({
          ...row,
          [op.name]: op.defaultValue ?? null,
        }));
        break;
      }
    }

    return {
      ...newState,
      data: newData,
      columns: newColumns,
      version: newState.version, // Version is managed by server
    };
  }, []);

  // Subscribe to sheet
  const subscribe = useCallback(() => {
    if (!enabled || !wsConnected) return;

    const message: ClientMessage = {
      type: 'subscribe',
      sheetId,
    };
    sendMessage(message);
  }, [enabled, wsConnected, sheetId, sendMessage]);

  // Unsubscribe (cleanup on unmount)
  const unsubscribe = useCallback(() => {
    // WebSocket cleanup handled by useWebSocket hook
  }, []);

  // Apply operation
  const applyOperation = useCallback(
    async (op: Omit<SheetOp, 'actor' | 'timestamp'>): Promise<boolean> => {
      if (!state || !wsConnected) {
        return false;
      }

      const fullOp: SheetOp = {
        ...op,
        actor: 'user', // Will be replaced by backend with actual userId
        timestamp: new Date().toISOString(),
      };

      // Optimistically apply to local state
      const optimisticState = applyOpToState(fullOp, state);
      setState(optimisticState);
      // Version will be updated when we receive op_applied from server

      // Send to server
      const message: ClientMessage = {
        type: 'op',
        sheetId,
        baseVersion: state.version,
        op: fullOp,
      };

      sendMessage(message);

      return true;
    },
    [state, wsConnected, sheetId, sendMessage, applyOpToState]
  );

  // Request AI analysis
  const requestAI = useCallback(
    (prompt: string, channelId: string) => {
      if (!state || !wsConnected) return;

      const message: ClientMessage = {
        type: 'request_ai',
        sheetId,
        version: state.version,
        channelId,
        prompt,
      };

      sendMessage(message);
    },
    [state, wsConnected, sheetId, sendMessage]
  );

  // Handle WebSocket messages
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = wsSubscribe((message: ServerMessage) => {
      switch (message.type) {
        case 'initial_state': {
          const initialState: SheetState = {
            sheetId: message.sheetId,
            version: message.version,
            schema: message.schema,
            data: message.initialRows || [],
            columns: message.schema.map(s => s.name),
            metadata: message.metadata,
          };
          setState(initialState);
          setVersion(message.version);
          setIsLoading(false);
          setError(null);
          break;
        }

        case 'op_applied': {
          if (message.sheetId === sheetId && state) {
            const newState = applyOpToState(message.op, state);
            newState.version = message.version;
            setState(newState);
            setVersion(message.version);
          }
          break;
        }

        case 'op_rejected': {
          if (message.sheetId === sheetId) {
            setError(message.reason);
            // Revert to server version if needed
            // For now, just log the error
            console.warn('Operation rejected:', message.reason);
          }
          break;
        }

        case 'snapshot_saved': {
          if (message.sheetId === sheetId) {
            // Optionally show a "Saved" indicator
            console.log('Snapshot saved at version', message.version);
          }
          break;
        }

        case 'error': {
          setError(message.message);
          break;
        }
      }
    });

    return unsubscribe;
  }, [enabled, sheetId, state, wsSubscribe, applyOpToState]);

  // Auto-subscribe when connected
  useEffect(() => {
    if (enabled && wsConnected && !state) {
      subscribe();
    }
  }, [enabled, wsConnected, state, subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    state,
    version,
    isConnected,
    isLoading,
    error,
    applyOperation,
    requestAI,
    subscribe,
    unsubscribe,
  };
}
