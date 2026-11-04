import { create } from 'zustand';

export interface SheetStatusSnapshot {
  visibleColumns: number;
  totalColumns: number;
  /** Rows currently shown (after filters). */
  visibleRows?: number;
  /** Full dataset row count (before filters). */
  totalRows?: number;
  cellRef: string | null;
  selectionCount?: number | null;
  selectionSum?: number | null;
  selectionAvg?: number | null;
}

function sheetStatusEqual(a: SheetStatusSnapshot | null, b: SheetStatusSnapshot | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.visibleColumns === b.visibleColumns &&
    a.totalColumns === b.totalColumns &&
    a.visibleRows === b.visibleRows &&
    a.totalRows === b.totalRows &&
    a.cellRef === b.cellRef &&
    a.selectionCount === b.selectionCount &&
    a.selectionSum === b.selectionSum &&
    a.selectionAvg === b.selectionAvg
  );
}

interface WorkspaceSheetStatusState {
  status: SheetStatusSnapshot | null;
  setStatus: (status: SheetStatusSnapshot) => void;
  clearStatus: () => void;
}

export const useWorkspaceSheetStatusStore = create<WorkspaceSheetStatusState>(set => ({
  status: null,
  setStatus: status => set(state => (sheetStatusEqual(state.status, status) ? state : { status })),
  clearStatus: () => set(state => (state.status == null ? state : { status: null })),
}));
