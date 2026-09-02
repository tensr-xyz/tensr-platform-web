import { create } from 'zustand';
import type { AnalysisKey } from '@/lib/analysis-definitions';
import { ANALYSIS_LABELS } from '@/lib/analysis-definitions';
import { isRetiredFromUi } from '@/lib/retired-from-ui';

export type UnavailableKind = 'roadmap' | 'retired';

type AnalysisSetupState = {
  setupOp: AnalysisKey | null;
  setupInitialBody: Record<string, unknown> | null;
  dialogName: string | null;
  dialogNonce: number;
  unavailableName: string | null;
  unavailableKind: UnavailableKind | null;
  commandPaletteOpen: boolean;
  openSetup: (op: AnalysisKey, initialBody?: Record<string, unknown> | null) => void;
  openSetupFromPalette: (op: AnalysisKey) => void;
  openDialog: (name: string) => void;
  openUnavailable: (featureName: string, kind?: UnavailableKind) => void;
  closeSetup: () => void;
  closeDialog: () => void;
  closeUnavailable: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  returnToCommandPalette: () => void;
};

function retiredUnavailable(op: AnalysisKey) {
  return {
    setupOp: null as AnalysisKey | null,
    setupInitialBody: null,
    dialogName: null,
    unavailableName: ANALYSIS_LABELS[op] || op,
    unavailableKind: 'retired' as const,
    commandPaletteOpen: false,
  };
}

export const useAnalysisSetupStore = create<AnalysisSetupState>(set => ({
  setupOp: null,
  setupInitialBody: null,
  dialogName: null,
  dialogNonce: 0,
  unavailableName: null,
  unavailableKind: null,
  commandPaletteOpen: false,
  openSetup: (op, initialBody = null) =>
    set(
      isRetiredFromUi(op)
        ? retiredUnavailable(op)
        : {
            setupOp: op,
            setupInitialBody: initialBody,
            dialogName: null,
            unavailableName: null,
            unavailableKind: null,
            commandPaletteOpen: false,
          }
    ),
  openSetupFromPalette: op =>
    set(
      isRetiredFromUi(op)
        ? retiredUnavailable(op)
        : {
            setupOp: op,
            setupInitialBody: null,
            dialogName: null,
            unavailableName: null,
            unavailableKind: null,
            commandPaletteOpen: false,
          }
    ),
  openDialog: name =>
    set(state => ({
      setupOp: null,
      dialogName: name,
      dialogNonce: state.dialogNonce + 1,
      unavailableName: null,
      unavailableKind: null,
      commandPaletteOpen: false,
    })),
  openUnavailable: (featureName, kind = 'roadmap') =>
    set({
      setupOp: null,
      dialogName: null,
      unavailableName: featureName,
      unavailableKind: kind,
      commandPaletteOpen: false,
    }),
  closeSetup: () => set({ setupOp: null, setupInitialBody: null }),
  closeDialog: () => set({ dialogName: null }),
  closeUnavailable: () => set({ unavailableName: null, unavailableKind: null }),
  setCommandPaletteOpen: open => set({ commandPaletteOpen: open }),
  returnToCommandPalette: () =>
    set({ setupOp: null, setupInitialBody: null, commandPaletteOpen: true }),
}));
