'use client';

import { useEffect } from 'react';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { isAnalysisPaletteShortcut } from '@/utils/keyboard-shortcuts';

/** Global ⌘K / Ctrl+K — toggles the analysis command palette from anywhere in the workspace. */
export function useAnalysisPaletteShortcut(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isAnalysisPaletteShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const { commandPaletteOpen, setCommandPaletteOpen } = useAnalysisSetupStore.getState();
      setCommandPaletteOpen(!commandPaletteOpen);
    };

    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);
}
