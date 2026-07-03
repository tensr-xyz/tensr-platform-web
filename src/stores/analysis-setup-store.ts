import { create } from 'zustand';
import type { AnalysisKey } from '@/lib/analysis-definitions';

type AnalysisSetupState = {
  setupOp: AnalysisKey | null;
  setupInitialBody: Record<string, unknown> | null;
  dialogName: string | null;
  dialogNonce: number;
  unavailableName: string | null;
  commandPaletteOpen: boolean;
  openSetup: (op: AnalysisKey, initialBody?: Record<string, unknown> | null) => void;
  openSetupFromPalette: (op: AnalysisKey) => void;
  openDialog: (name: string) => void;
  openUnavailable: (featureName: string) => void;
  closeSetup: () => void;
  closeDialog: () => void;
  closeUnavailable: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  returnToCommandPalette: () => void;
};

export const useAnalysisSetupStore = create<AnalysisSetupState>(set => ({
  setupOp: null,
  setupInitialBody: null,
  dialogName: null,
  dialogNonce: 0,
  unavailableName: null,
  commandPaletteOpen: false,
  openSetup: (op, initialBody = null) =>
    set({
      setupOp: op,
      setupInitialBody: initialBody,
      dialogName: null,
      unavailableName: null,
      commandPaletteOpen: false,
    }),
  openSetupFromPalette: op =>
    set({
      setupOp: op,
      setupInitialBody: null,
      dialogName: null,
      unavailableName: null,
      commandPaletteOpen: false,
    }),
  openDialog: name =>
    set(state => ({
      setupOp: null,
      dialogName: name,
      dialogNonce: state.dialogNonce + 1,
      unavailableName: null,
      commandPaletteOpen: false,
    })),
  openUnavailable: featureName =>
    set({
      setupOp: null,
      dialogName: null,
      unavailableName: featureName,
      commandPaletteOpen: false,
    }),
  closeSetup: () => set({ setupOp: null, setupInitialBody: null }),
  closeDialog: () => set({ dialogName: null }),
  closeUnavailable: () => set({ unavailableName: null }),
  setCommandPaletteOpen: open => set({ commandPaletteOpen: open }),
  returnToCommandPalette: () =>
    set({ setupOp: null, setupInitialBody: null, commandPaletteOpen: true }),
}));
