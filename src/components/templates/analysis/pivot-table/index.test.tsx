import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { apiClient } from '@/lib/api-client';
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

  it('does not print column letters while Column letters is unticked', async () => {
    (apiClient.datasets.analyze.run as jest.Mock).mockResolvedValue({
      result: {
        matrix: {
          columns: [{ path: ['A'], kind: 'value' }],
          rows: [{ path: ['row'], kind: 'value', cells: [{ value: 10, letters: 'B' }] }],
        },
      },
    });
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
    fireEvent.drop(screen.getByText('Rows').parentElement!, { dataTransfer });
    fireEvent.click(screen.getByRole('button', { name: 'Update pivot' }));
    await waitFor(() => expect(screen.getByText('10')).toBeInTheDocument());
    expect(screen.getByRole('checkbox', { name: 'Column letters' })).not.toBeChecked();
    expect(screen.getByText('10').textContent).toBe('10');
  });
});
