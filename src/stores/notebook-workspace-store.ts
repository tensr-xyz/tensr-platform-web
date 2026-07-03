import { create } from 'zustand';

export type NotebookWorkspaceControls = {
  language: 'python' | 'r';
  newCellType: 'code' | 'markdown';
  isExecuting: boolean;
  canRun: boolean;
  runAll: () => void;
  runSelected: () => void;
  addCell: () => void;
  setLanguage: (lang: 'python' | 'r') => void;
  setNewCellType: (type: 'code' | 'markdown') => void;
};

const defaultControls: NotebookWorkspaceControls = {
  language: 'python',
  newCellType: 'code',
  isExecuting: false,
  canRun: false,
  runAll: () => {},
  runSelected: () => {},
  addCell: () => {},
  setLanguage: () => {},
  setNewCellType: () => {},
};

type NotebookWorkspaceStore = {
  controls: NotebookWorkspaceControls;
  setControls: (patch: Partial<NotebookWorkspaceControls>) => void;
  reset: () => void;
};

export const useNotebookWorkspaceStore = create<NotebookWorkspaceStore>(set => ({
  controls: defaultControls,
  setControls: patch =>
    set(state => ({
      controls: { ...state.controls, ...patch },
    })),
  reset: () => set({ controls: defaultControls }),
}));
