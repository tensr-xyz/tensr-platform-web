import { useState, useEffect, useCallback, useRef } from 'react';
import { SheetState, SheetOp, ServerMessage, ClientMessage, ColumnSchema } from '@/types/sheet';
import { useWebSocket } from '../use-websocket';
import { getIdToken } from '@/utils/auth';
import { getTensrWebSocketUrl } from '@/lib/tensr-api-url';
import { devLog } from '@/lib/dev-log';

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
  // Mirror `state` into a ref so the WS message effect doesn't need to re-subscribe
  // on every server-applied op (which would cause subscribe/unsubscribe churn and
  // CPU spikes under live-collab load).
  const stateRef = useRef<SheetState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Get WebSocket URL from environment or config
  const getWebSocketUrl = useCallback(() => {
    const wsBaseUrl =
      process.env.NEXT_PUBLIC_WEBSOCKET_URL?.replace(/\/$/, '') ||
      getTensrWebSocketUrl('/realtime');
    const separator = wsBaseUrl.includes('?') ? '&' : '?';
    return `${wsBaseUrl}${separator}sheetId=${encodeURIComponent(sheetId)}`;
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

  // Apply operation. Read state via ref so this callback stays stable across
  // state updates — Spreadsheet uses it in effect deps.
  const applyOperation = useCallback(
    async (op: Omit<SheetOp, 'actor' | 'timestamp'>): Promise<boolean> => {
      const current = stateRef.current;
      if (!current || !wsConnected) {
        return false;
      }

      const fullOp: SheetOp = {
        ...op,
        actor: 'user',
        timestamp: new Date().toISOString(),
      } as SheetOp;

      const optimisticState = applyOpToState(fullOp, current);
      setState(optimisticState);

      const message: ClientMessage = {
        type: 'op',
        sheetId,
        baseVersion: current.version,
        op: fullOp,
      };

      sendMessage(message);
      return true;
    },
    [wsConnected, sheetId, sendMessage, applyOpToState]
  );

  // Request AI analysis
  const requestAI = useCallback(
    (prompt: string, channelId: string) => {
      const current = stateRef.current;
      if (!current || !wsConnected) return;

      const message: ClientMessage = {
        type: 'request_ai',
        sheetId,
        version: current.version,
        channelId,
        prompt,
      };

      sendMessage(message);
    },
    [wsConnected, sheetId, sendMessage]
  );

  // Handle WebSocket messages
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = wsSubscribe(message => {
      const serverMessage = message as ServerMessage;
      switch (serverMessage.type) {
        case 'initial_state': {
          const initialState: SheetState = {
            sheetId: serverMessage.sheetId,
            version: serverMessage.version,
            schema: serverMessage.schema,
            data: serverMessage.initialRows || [],
            columns: serverMessage.schema.map(s => s.name),
            metadata: serverMessage.metadata,
          };
          setState(initialState);
          setVersion(serverMessage.version);
          setIsLoading(false);
          setError(null);
          break;
        }

        case 'op_applied': {
          if (serverMessage.sheetId === sheetId && stateRef.current) {
            const newState = applyOpToState(serverMessage.op, stateRef.current);
            newState.version = serverMessage.version;
            setState(newState);
            setVersion(serverMessage.version);
          }
          break;
        }

        case 'op_rejected': {
          if (serverMessage.sheetId === sheetId) {
            setError(serverMessage.reason);
            // Revert to server version if needed
            // For now, just log the error
            console.warn('Operation rejected:', serverMessage.reason);
          }
          break;
        }

        case 'snapshot_saved': {
          if (serverMessage.sheetId === sheetId) {
            // Optionally show a "Saved" indicator
            devLog('Snapshot saved at version', serverMessage.version);
          }
          break;
        }

        case 'error': {
          setError(serverMessage.message);
          break;
        }
      }
    });

    return unsubscribe;
  }, [enabled, sheetId, wsSubscribe, applyOpToState]);

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
