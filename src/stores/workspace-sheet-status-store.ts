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

interface WorkspaceSheetStatusState {
  status: SheetStatusSnapshot | null;
  setStatus: (status: SheetStatusSnapshot) => void;
  clearStatus: () => void;
}

export const useWorkspaceSheetStatusStore = create<WorkspaceSheetStatusState>(set => ({
  status: null,
  setStatus: status => set({ status }),
  clearStatus: () => set({ status: null }),
}));
