import { create } from 'zustand';

export interface SheetStatusSnapshot {
  visibleColumns: number;
  totalColumns: number;
  cellRef: string | null;
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
