import { useAnalysisSetupStore } from './analysis-setup-store';

describe('analysis-setup-store retired ops', () => {
  beforeEach(() => {
    useAnalysisSetupStore.setState({
      setupOp: null,
      setupInitialBody: null,
      dialogName: null,
      unavailableName: null,
      unavailableKind: null,
      commandPaletteOpen: false,
    });
  });

  it('does not open a wizard for retired ops; shows the retired notice instead', () => {
    useAnalysisSetupStore.getState().openSetup('mcnemar');
    const state = useAnalysisSetupStore.getState();
    expect(state.setupOp).toBeNull();
    expect(state.unavailableName).toBe('McNemar Test');
    expect(state.unavailableKind).toBe('retired');
  });

  it('still opens a wizard for a live analysis', () => {
    useAnalysisSetupStore.getState().openSetup('descriptives');
    expect(useAnalysisSetupStore.getState().setupOp).toBe('descriptives');
    expect(useAnalysisSetupStore.getState().unavailableName).toBeNull();
  });

  it('opens a wizard for LCA from the palette path', () => {
    useAnalysisSetupStore.getState().openSetupFromPalette('latent_class_analysis');
    expect(useAnalysisSetupStore.getState().setupOp).toBe('latent_class_analysis');
    expect(useAnalysisSetupStore.getState().unavailableKind).toBeNull();
  });
});
