import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OneWayAnova } from './index';
import { useTabsStore, ViewType } from '@/stores/tabs-store';
import { exportTable } from '@/utils/table-export';

const toast = jest.fn();

jest.mock('@/hooks/ui/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
jest.mock('@/utils/auth', () => ({ getIdToken: () => 'token' }));
jest.mock('@/hooks/api/use-auth', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('@/components/organisms/markdown-viewer', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/utils/table-export', () => ({
  exportTable: jest.fn(),
  copyTableToClipboard: jest.fn(),
}));
jest.mock('@/lib/workspace-dataset', () => ({
  getDatasetIdFromTab: () => 'ds-1',
  WORKSPACE_DATASET_REQUIRED: 'Dataset required',
}));
jest.mock('@/lib/workspace-analysis', () => ({
  runDatasetAnalysis: jest.fn(async () => ({})),
  adaptAnovaResults: () => ({
    f_statistic: 4.2,
    p_value: 0.03,
    df_between: 1,
    df_within: 4,
    sum_squares_between: 2,
    sum_squares_within: 3,
    mean_square_between: 2,
    mean_square_within: 0.75,
    effect_size: 0.4,
    group_descriptives: [],
    total_n: 6,
    grand_mean: 2,
    interpretation: 'Groups differ.',
    report_content: '{}',
    report_timestamp: '2026-10-03T00:00:00Z',
  }),
}));
jest.mock('@/components/molecules/dialog', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Pass,
    DialogContent: Pass,
    DialogFooter: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
  };
});
jest.mock('@/components/molecules/dropdown', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: Pass,
    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
    }) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
  };
});

const exportTableMock = exportTable as jest.Mock;

async function renderResults() {
  useTabsStore.setState({
    tabs: [
      {
        id: 'sheet-1',
        name: 'data.csv',
        type: ViewType.SPREADSHEET,
        isDirty: false,
        data: {
          initialData: [
            { grp: 'a', score: 1 },
            { grp: 'a', score: 2 },
            { grp: 'b', score: 3 },
            { grp: 'b', score: 4 },
          ],
        },
      },
    ],
    activeTabId: 'sheet-1',
  } as never);

  render(
    <OneWayAnova>
      <span />
    </OneWayAnova>
  );
  fireEvent.click(screen.getByText('grp'));
  fireEvent.click(screen.getByText('score'));
  fireEvent.click(screen.getByRole('button', { name: /Calculate ANOVA/ }));
  await screen.findByText('Groups differ.');
}

describe('OneWayAnova table export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('toasts success only after a CSV export finishes', async () => {
    let finish: () => void = () => {};
    exportTableMock.mockReturnValue(new Promise<void>(resolve => (finish = resolve)));
    await renderResults();

    fireEvent.click(screen.getAllByRole('button', { name: /Export as CSV/ })[0]);
    expect(exportTableMock).toHaveBeenCalledWith(expect.any(HTMLTableElement), {
      filename: expect.any(String),
      format: 'csv',
    });
    await act(async () => {});
    expect(toast).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Export successful' }));
  });

  it.each(['CSV', 'PNG Image'])('shows an error toast when a %s export fails', async label => {
    const failed = Promise.reject(new Error('Could not render the table as a PNG image.'));
    failed.catch(() => {});
    exportTableMock.mockReturnValue(failed);
    await renderResults();

    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(`Export as ${label}`) })[0]);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Export failed',
          description: 'Could not render the table as a PNG image.',
          variant: 'destructive',
        })
      )
    );
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Export successful' }));
  });
});
