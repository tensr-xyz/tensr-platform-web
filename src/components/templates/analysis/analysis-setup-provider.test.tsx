import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { AnalysisSetupHost } from './analysis-setup-provider';
import { ANALYSIS_LABELS, type AnalysisKey } from '@/lib/analysis-definitions';
import { dialogMenuNames } from '@/configs/analysis-config/menu-registry';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { useTabsStore, ViewType } from '@/stores/tabs-store';

jest.mock('@/configs/analysis-config/menu-registry', () => {
  const actual = jest.requireActual('@/configs/analysis-config/menu-registry');
  return {
    ...actual,
    getMenuItemComponent: () =>
      function FakeMenu({ children }: { children?: React.ReactNode }) {
        return <>{children}</>;
      },
  };
});

jest.mock('@/lib/api-client', () => ({
  apiClient: { datasets: { getSchema: jest.fn() } },
}));

const sheetTab = {
  id: 'sheet-1',
  name: 'Raw Data 300426.xlsx',
  type: ViewType.SPREADSHEET,
  isDirty: false,
  data: { datasetId: 'ds-1' },
};

function resultTab(id: string, analysisOp: string) {
  return {
    id,
    name: id,
    type: ViewType.ANALYSIS_RESULT,
    isDirty: false,
    data: { analysisOp },
  };
}

describe('AnalysisSetupHost dialog launcher', () => {
  beforeEach(() => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    useAnalysisSetupStore.setState({
      dialogName: null,
      dialogNonce: 0,
      setupOp: null,
      setupInitialBody: null,
      unavailableName: null,
      unavailableKind: null,
    });
    useTabsStore.setState({
      tabs: [sheetTab],
      activeTabId: 'sheet-1',
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not reopen Custom Tables when an agent result tab becomes active', () => {
    const click = jest.spyOn(HTMLButtonElement.prototype, 'click');
    render(<AnalysisSetupHost />);

    act(() => {
      useAnalysisSetupStore.getState().openDialog('Custom Tables');
    });
    expect(click).toHaveBeenCalledTimes(1);

    act(() => {
      useTabsStore.setState({
        activeTabId: 'result-1',
        tabs: [...useTabsStore.getState().tabs, resultTab('result-1', 'banner_table')],
      } as never);
    });
    expect(click).toHaveBeenCalledTimes(1);
    expect(useAnalysisSetupStore.getState().dialogName).toBeNull();

    act(() => {
      useAnalysisSetupStore.getState().openDialog('Custom Tables');
    });
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('does not open a setup dialog when any analysis result tab becomes active', () => {
    const click = jest.spyOn(HTMLButtonElement.prototype, 'click');
    render(<AnalysisSetupHost />);
    const names = dialogMenuNames();
    expect(names).toContain('Rake Weights');
    expect(names).toContain('Custom Tables');

    names.forEach((name, index) => {
      act(() => {
        useTabsStore.setState({ activeTabId: 'sheet-1' } as never);
        useAnalysisSetupStore.getState().openDialog(name);
      });
      const clicksAfterOpen = click.mock.calls.length;
      expect(useAnalysisSetupStore.getState().dialogName).toBe(name);

      const id = `result-dialog-${index}`;
      act(() => {
        useTabsStore.setState({
          activeTabId: id,
          tabs: [sheetTab, resultTab(id, name)],
        } as never);
      });

      expect(click.mock.calls.length).toBe(clicksAfterOpen);
      expect(useAnalysisSetupStore.getState().dialogName).toBeNull();
      expect(useAnalysisSetupStore.getState().setupOp).toBeNull();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    (Object.keys(ANALYSIS_LABELS) as AnalysisKey[]).forEach((op, index) => {
      act(() => {
        useTabsStore.setState({ activeTabId: 'sheet-1' } as never);
        useAnalysisSetupStore.getState().openSetup(op);
      });
      expect(
        useAnalysisSetupStore.getState().setupOp === op ||
          useAnalysisSetupStore.getState().unavailableName != null
      ).toBe(true);

      const id = `result-op-${index}`;
      act(() => {
        useTabsStore.setState({
          activeTabId: id,
          tabs: [sheetTab, resultTab(id, op)],
        } as never);
      });

      expect(useAnalysisSetupStore.getState().setupOp).toBeNull();
      expect(useAnalysisSetupStore.getState().dialogName).toBeNull();
      expect(useAnalysisSetupStore.getState().unavailableName).toBeNull();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
