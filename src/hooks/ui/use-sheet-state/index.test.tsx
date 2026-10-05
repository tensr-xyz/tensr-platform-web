import { act, renderHook, waitFor } from '@testing-library/react';
import { useSheetState } from './index';

type Listener = (message: Record<string, any>) => void;

const mockWs = {
  listeners: new Set<Listener>(),
  sent: [] as { sheetId: string; baseVersion: number; op: any }[],
  subscribes: [] as string[],
  isSocketOpen: true,
  emit(message: Record<string, any>) {
    this.listeners.forEach(listener => listener(message));
  },
};

jest.mock('@/hooks/ui/use-session', () => ({
  wsService: {
    get isSocketOpen() {
      return mockWs.isSocketOpen;
    },
    onWsReady: (cb: (ready: boolean) => void) => {
      cb(true);
      return () => {};
    },
    onSheetMessage: (cb: Listener) => {
      mockWs.listeners.add(cb);
      return () => mockWs.listeners.delete(cb);
    },
    subscribeToSheet: (sheetId: string) => mockWs.subscribes.push(sheetId),
    unsubscribeFromSheet: () => {},
    sendSheetOp: (sheetId: string, baseVersion: number, op: any) =>
      mockWs.sent.push({ sheetId, baseVersion, op }),
    sendSheetMessage: () => {},
  },
}));

let resolveSnapshot: (rows: Record<string, any>[]) => void = () => {};
jest.mock('@/lib/collab-snapshot', () => ({
  fetchSnapshotRows: () =>
    new Promise(resolve => {
      resolveSnapshot = resolve;
    }),
}));

const SHEET = 'session:s1';
const ROWS = [
  { group: 'a', score: 1 },
  { group: 'b', score: 2 },
];

function initialState(version = 0) {
  return {
    type: 'initial_state',
    sheetId: SHEET,
    version,
    snapshotVersion: 0,
    schema: [
      { name: 'group', type: 'string', nullable: true },
      { name: 'score', type: 'number', nullable: true },
    ],
    columns: ['group', 'score'],
    metadata: {},
    snapshotUrl: 'https://bucket.s3.amazonaws.com/collab/s1/snapshot.parquet',
    ops: [],
  };
}

function cellOp(row: number, newValue: string) {
  return { kind: 'update_cell' as const, row, column: 'score', oldValue: '', newValue };
}

beforeEach(() => {
  mockWs.listeners.clear();
  mockWs.sent = [];
  mockWs.subscribes = [];
  mockWs.isSocketOpen = true;
});

describe('useSheetState', () => {
  it('refuses an edit while the shared copy is still loading, so nothing is kept local-only', async () => {
    const { result } = renderHook(() => useSheetState({ sheetId: SHEET }));
    act(() => mockWs.emit(initialState()));

    let sent = true;
    await act(async () => {
      sent = await result.current.applyOperation(cellOp(0, '1000'));
    });

    expect(sent).toBe(false);
    expect(mockWs.sent).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('sends the edit once the snapshot has loaded', async () => {
    const { result } = renderHook(() => useSheetState({ sheetId: SHEET }));
    act(() => mockWs.emit(initialState()));
    await act(async () => resolveSnapshot(ROWS));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    let sent = false;
    await act(async () => {
      sent = await result.current.applyOperation(cellOp(0, '1000'));
    });

    expect(sent).toBe(true);
    expect(mockWs.sent).toEqual([
      expect.objectContaining({
        sheetId: SHEET,
        baseVersion: 0,
        op: expect.objectContaining({ newValue: '1000' }),
      }),
    ]);
    expect(result.current.state?.data[0].score).toBe('1000');
  });

  it('keeps edits other users make while the snapshot is downloading', async () => {
    const { result } = renderHook(() => useSheetState({ sheetId: SHEET }));
    act(() => mockWs.emit(initialState()));
    act(() =>
      mockWs.emit({ type: 'op_applied', sheetId: SHEET, version: 1, op: cellOp(1, '200') })
    );
    await act(async () => resolveSnapshot(ROWS));

    await waitFor(() => expect(result.current.state).not.toBeNull());
    expect(result.current.state?.data[1].score).toBe('200');
    expect(result.current.version).toBe(1);
  });

  it('applies another user’s edit on top of this user’s own edit', async () => {
    const { result } = renderHook(() => useSheetState({ sheetId: SHEET }));
    act(() => mockWs.emit(initialState()));
    await act(async () => resolveSnapshot(ROWS));
    await waitFor(() => expect(result.current.state).not.toBeNull());

    await act(async () => {
      await result.current.applyOperation(cellOp(0, '100'));
    });
    act(() =>
      mockWs.emit({ type: 'op_applied', sheetId: SHEET, version: 1, op: cellOp(0, '100') })
    );
    act(() =>
      mockWs.emit({ type: 'op_applied', sheetId: SHEET, version: 2, op: cellOp(1, '400') })
    );

    expect(result.current.state?.data.map(r => r.score)).toEqual(['100', '400']);
    expect(result.current.version).toBe(2);
  });

  it('drops a rejected edit, tells the caller, and resyncs from the server', async () => {
    const onOpRejected = jest.fn();
    const { result } = renderHook(() => useSheetState({ sheetId: SHEET, onOpRejected }));
    act(() => mockWs.emit(initialState()));
    await act(async () => resolveSnapshot(ROWS));
    await waitFor(() => expect(result.current.state).not.toBeNull());
    const subscribesBefore = mockWs.subscribes.length;

    await act(async () => {
      await result.current.applyOperation(cellOp(0, '999'));
    });
    act(() =>
      mockWs.emit({
        type: 'op_rejected',
        sheetId: SHEET,
        reason: 'Version conflict',
        baseVersion: 0,
      })
    );

    expect(onOpRejected).toHaveBeenCalledWith('Version conflict');
    expect(result.current.state).toBeNull();
    await waitFor(() => expect(mockWs.subscribes.length).toBe(subscribesBefore + 1));

    act(() => mockWs.emit(initialState(0)));
    await act(async () => resolveSnapshot(ROWS));
    await waitFor(() => expect(result.current.state?.data[0].score).toBe(1));
  });
});
