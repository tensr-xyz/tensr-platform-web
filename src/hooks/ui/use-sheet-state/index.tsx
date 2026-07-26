import { useState, useEffect, useCallback, useRef } from 'react';
import { SheetState, SheetOp, ServerMessage, ColumnSchema } from '@/types/sheet';
import { wsService } from '@/hooks/ui/use-session';
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

/**
 * Live sheet op-log (persisted via `sheet_live_dynamo` / `app/sheet_live.py`).
 *
 * This shares the single WebSocket connection managed by `wsService` (see
 * `hooks/ui/use-session`) instead of opening its own socket. That connection
 * already carries collaboration-session `join`/presence traffic when a session
 * is active, so subscribing a sheet on it ties sheet sync to that session and
 * lets the server's existing viewer-role check (`_reject_viewer_op`) apply to
 * sheet `op` messages too — a Viewer on the same connection is rejected the
 * same way for `op` as they are for session messages.
 */
export function useSheetState({
  sheetId,
  enabled = true,
}: UseSheetStateOptions): UseSheetStateReturn {
  const [state, setState] = useState<SheetState | null>(null);
  const [version, setVersion] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(wsService.isSocketOpen);
  // Mirror `state` into a ref so the WS message effect doesn't need to re-subscribe
  // on every server-applied op (which would cause subscribe/unsubscribe churn and
  // CPU spikes under live-collab load).
  const stateRef = useRef<SheetState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!enabled) return;
    return wsService.onWsReady(ready => setIsConnected(ready));
  }, [enabled]);

  // Reset local state whenever the sheet identity changes (e.g. session ends).
  useEffect(() => {
    setState(null);
    setVersion(0);
    setIsLoading(true);
    setError(null);
  }, [sheetId]);

  // Subscribe to sheet
  const subscribe = useCallback(() => {
    if (!enabled || !sheetId) return;
    wsService.subscribeToSheet(sheetId);
  }, [enabled, sheetId]);

  // Unsubscribe (best-effort local bookkeeping; the shared socket may still be
  // needed by the collaboration session, so it is never closed here).
  const unsubscribe = useCallback(() => {
    if (!sheetId) return;
    wsService.unsubscribeFromSheet(sheetId);
  }, [sheetId]);

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

  // Apply operation. Read state via ref so this callback stays stable across
  // state updates — Spreadsheet uses it in effect deps.
  const applyOperation = useCallback(
    async (op: Omit<SheetOp, 'actor' | 'timestamp'>): Promise<boolean> => {
      const current = stateRef.current;
      if (!current || !wsService.isSocketOpen) {
        return false;
      }

      const fullOp: SheetOp = {
        ...op,
        actor: 'user',
        timestamp: new Date().toISOString(),
      } as SheetOp;

      const optimisticState = applyOpToState(fullOp, current);
      setState(optimisticState);

      wsService.sendSheetOp(sheetId, current.version, fullOp);
      return true;
    },
    [sheetId, applyOpToState]
  );

  // Request AI analysis.
  // TODO(full live sheet sync): production `app/realtime/hub.py` does not handle
  // `request_ai` today (only the local in-memory `app/realtime_hub.py` stubs it with
  // an `ai_error` reply) — this message currently goes unanswered against RealtimeStack.
  const requestAI = useCallback(
    (prompt: string, channelId: string) => {
      const current = stateRef.current;
      if (!current || !wsService.isSocketOpen) return;

      wsService.sendSheetMessage({
        type: 'request_ai',
        sheetId,
        version: current.version,
        channelId,
        prompt,
      });
    },
    [sheetId]
  );

  // Handle sheet messages arriving on the shared connection
  useEffect(() => {
    if (!enabled) return;

    return wsService.onSheetMessage(rawMessage => {
      const serverMessage = rawMessage as ServerMessage & { sheetId?: string };
      // The shared connection may carry messages for other tabs' sheets too.
      if (serverMessage.sheetId !== undefined && serverMessage.sheetId !== sheetId) {
        return;
      }

      switch (serverMessage.type) {
        case 'initial_state': {
          const initialState: SheetState = {
            sheetId: serverMessage.sheetId,
            version: serverMessage.version,
            schema: serverMessage.schema,
            data: serverMessage.initialRows || [],
            columns: serverMessage.schema.map((s: ColumnSchema) => s.name),
            metadata: serverMessage.metadata,
          };
          setState(initialState);
          setVersion(serverMessage.version);
          setIsLoading(false);
          setError(null);
          break;
        }

        case 'op_applied': {
          if (stateRef.current) {
            const newState = applyOpToState(serverMessage.op, stateRef.current);
            newState.version = serverMessage.version;
            setState(newState);
            setVersion(serverMessage.version);
          }
          break;
        }

        case 'op_rejected': {
          setError(serverMessage.reason);
          console.warn('Operation rejected:', serverMessage.reason);
          break;
        }

        case 'snapshot_saved': {
          devLog('Snapshot saved at version', serverMessage.version);
          break;
        }

        case 'error': {
          if ('message' in serverMessage) {
            setError(serverMessage.message);
          }
          break;
        }
      }
    });
  }, [enabled, sheetId, applyOpToState]);

  // Auto-subscribe when the shared socket is connected
  useEffect(() => {
    if (enabled && isConnected && !state) {
      subscribe();
    }
  }, [enabled, isConnected, state, subscribe]);

  // Unsubscribe local bookkeeping on unmount/sheetId change — does not close the
  // shared socket, which may still be serving the collaboration session or other tabs.
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
