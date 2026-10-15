import React from 'react';
import { act, render } from '@testing-library/react';
import { AnalysisSetupHost } from './analysis-setup-provider';
import { useAnalysisSetupStore } from '@/stores/analysis-setup-store';
import { useTabsStore, ViewType } from '@/stores/tabs-store';

jest.mock('@/configs/analysis-config/menu-registry', () => ({
  getMenuItemComponent: () =>
    function FakeMenu({ children }: { children?: React.ReactNode }) {
      return <>{children}</>;
    },
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: { datasets: { getSchema: jest.fn() } },
}));

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
      unavailableName: null,
    });
    useTabsStore.setState({
      tabs: [
        {
          id: 'sheet-1',
          name: 'Raw Data 300426.xlsx',
          type: ViewType.SPREADSHEET,
          isDirty: false,
          data: { datasetId: 'ds-1' },
        },
      ],
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
        tabs: [
          ...useTabsStore.getState().tabs,
          {
            id: 'result-1',
            name: 'Custom Tables — Q1_Satisfaction by Group',
            type: ViewType.ANALYSIS_RESULT,
            isDirty: false,
            data: { analysisOp: 'banner_table' },
          },
        ],
      } as never);
    });
    expect(click).toHaveBeenCalledTimes(1);

    act(() => {
      useAnalysisSetupStore.getState().openDialog('Custom Tables');
    });
    expect(click).toHaveBeenCalledTimes(2);
  });
});
