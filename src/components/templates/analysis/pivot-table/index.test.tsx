import { fireEvent, render, screen } from '@testing-library/react';

import { useTabsStore, ViewType } from '@/stores/tabs-store';

import { PivotTableDialog } from './index';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    datasets: { analyze: { run: jest.fn() } },
  },
}));

jest.mock('@/lib/open-analysis-result-tab', () => ({
  openAnalysisResultTab: jest.fn(),
}));

describe('pivot table dialog', () => {
  beforeEach(() => {
    useTabsStore.setState({
      tabs: [
        {
          id: 'sheet-1',
          name: 'cars_EN + fr + de',
          type: ViewType.SPREADSHEET,
          content: '',
          isDirty: false,
          path: '4e27a1b5-5097-4cd2-8a25-4a691bc1dd63',
          data: {
            datasetId: '4e27a1b5-5097-4cd2-8a25-4a691bc1dd63',
            initialColumns: [
              {
                id: 'aware_A',
                accessor: 'aware_A',
                header: 'aware_A',
                width: 80,
                type: 'text',
              },
            ],
            initialData: [{ aware_A: 'audi' }],
            totalRows: 1,
            totalColumns: 1,
          },
        },
      ],
      activeTabId: 'sheet-1',
    });
  });

  it('renders Up, Down, and Remove as buttons in a zone', () => {
    render(
      <PivotTableDialog>
        <button type="button">Open pivot</button>
      </PivotTableDialog>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open pivot' }));

    const dataTransfer = {
      setData: jest.fn(),
      getData: (type: string) => (type === 'application/x-tensr-column' ? 'aware_A' : ''),
    };
    fireEvent.dragStart(screen.getByText('aware_A'), { dataTransfer });
    const rowsZone = screen.getByText('Rows').parentElement;
    expect(rowsZone).not.toBeNull();
    fireEvent.drop(rowsZone!, { dataTransfer });

    for (const name of ['Move up', 'Move down', 'Remove']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveClass('h-6');
      expect(button).toHaveClass('w-6');
      expect(button.querySelector('svg')).not.toBeNull();
    }
  });
});
