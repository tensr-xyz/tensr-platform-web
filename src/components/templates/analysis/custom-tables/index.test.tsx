import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CustomTablesDialog } from './index';
import { useTabsStore, ViewType } from '@/stores/tabs-store';
import { replayOperations } from '@/lib/dataset-data-ops';
import { listSavedTables, previewCustomTable, runCustomTable } from '@/lib/custom-tables/api';
import { openAnalysisResultTab } from '@/lib/open-analysis-result-tab';
import { runDatasetAnalysis } from '@/lib/workspace-analysis';

jest.mock('@/utils/auth', () => ({ getAccessToken: () => 'token' }));
jest.mock('@/lib/dataset-data-ops', () => ({
  datasetRequest: jest.fn(async () => ({ sets: [] })),
  replayOperations: jest.fn(),
  setActiveWeight: jest.fn(),
}));
jest.mock('@/lib/custom-tables/api', () => ({
  previewCustomTable: jest.fn(),
  runCustomTable: jest.fn(),
  listSavedTables: jest.fn(async () => ({ specs: [] })),
  listNamedBanners: jest.fn(async () => ({ banners: [] })),
  listDatasetVersions: jest.fn(async () => ({ origin_dataset_id: 'ds', versions: [] })),
  getSavedTable: jest.fn(),
  downloadTableExport: jest.fn(),
  drillTableCell: jest.fn(),
  saveNamedBanner: jest.fn(),
}));
jest.mock('@/lib/workspace-analysis', () => ({
  runDatasetAnalysis: jest.fn(async () => ({ report: { title: 'Banner' }, run_id: 'run-1' })),
}));
jest.mock('@/lib/open-analysis-result-tab', () => ({
  openAnalysisResultTab: jest.fn(),
}));
jest.mock('@/components/molecules/dialog', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Pass,
    DialogContent: Pass,
    DialogFooter: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogTrigger: Pass,
  };
});

const replayMock = replayOperations as jest.Mock;
const previewMock = previewCustomTable as jest.Mock;
const runMock = runCustomTable as jest.Mock;
const listSavedMock = listSavedTables as jest.Mock;
const openReportMock = openAnalysisResultTab as jest.Mock;
const analyzeMock = runDatasetAnalysis as jest.Mock;

const DATASET_ID = 'cf509f57-0000-4000-8000-000000000001';

describe('Custom Tables dialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTabsStore.setState({
      tabs: [
        {
          id: 'sheet-1',
          name: 'Raw Data 300426.xlsx',
          type: ViewType.SPREADSHEET,
          isDirty: false,
          data: {
            datasetId: DATASET_ID,
            initialColumns: [
              { id: 'Q1_Satisfaction', header: 'Q1_Satisfaction' },
              { id: 'Group', header: 'Group' },
            ],
            initialData: [{ Q1_Satisfaction: 1, Group: 'Control' }],
          },
        },
      ],
      activeTabId: 'sheet-1',
    } as never);
  });

  it('shows the table cells after Run these tables on this file', async () => {
    replayMock.mockResolvedValue({
      dataset_id: DATASET_ID,
      derived_dataset_id: null,
      replay_report: {
        applied: ['import', 'table_spec'],
        table: {
          banner_columns: [
            { id: 'total', label: 'Total' },
            { id: 'Group=Control', label: 'Control' },
          ],
          rows: [
            {
              id: 'q:1',
              label: '1',
              kind: 'value',
              cells: [
                {
                  banner_id: 'total',
                  stub_row_id: 'q:1',
                  count: 38,
                  percent: 14.7,
                  unweighted_n: 38,
                  weighted_n: 38,
                },
                {
                  banner_id: 'Group=Control',
                  stub_row_id: 'q:1',
                  count: 17,
                  percent: 21.5,
                  unweighted_n: 17,
                  weighted_n: 17,
                },
              ],
            },
          ],
          spec: { id: 'spec-1', statistics: ['column_proportion'] },
        },
      },
    });

    render(
      <CustomTablesDialog>
        <span>Open</span>
      </CustomTablesDialog>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run these tables on this file' }));
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(screen.getByText(/n=38/)).toBeInTheDocument();
    expect(screen.getByText(/n=17/)).toBeInTheDocument();
    expect(replayMock).toHaveBeenCalledWith(
      DATASET_ID,
      expect.objectContaining({
        operation_list: expect.objectContaining({ schema_version: 1 }),
      }),
      'token'
    );
  });

  it('keeps a plain Run out of Saved tables and confirms Run and save', async () => {
    previewMock.mockResolvedValue({ warnings: [] });
    runMock.mockResolvedValue({
      spec: { id: 'spec-1' },
      banner_columns: [],
      rows: [],
    });
    render(
      <CustomTablesDialog>
        <span>Open</span>
      </CustomTablesDialog>
    );
    fireEvent.click(screen.getByRole('option', { name: 'Q1_Satisfaction' }));
    fireEvent.click(screen.getByLabelText(/Banner \(columns\)/));
    fireEvent.click(screen.getByRole('option', { name: 'Group' }));

    expect(screen.getByText(/Run and save stores the spec/)).toBeInTheDocument();
    expect(screen.queryByText(/Run stores the spec/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(runMock).toHaveBeenCalled());
    expect(runMock).toHaveBeenCalledWith(
      DATASET_ID,
      expect.objectContaining({ save: false }),
      'token'
    );
    expect(previewMock).toHaveBeenCalledWith(
      DATASET_ID,
      expect.objectContaining({ save: false }),
      'token'
    );
    expect(listSavedMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Table saved.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run and save' }));
    expect(await screen.findByText('Table saved.')).toBeInTheDocument();
    expect(runMock).toHaveBeenCalledTimes(2);
    expect(runMock.mock.calls.filter(call => call[1]?.save === true)).toHaveLength(1);
    expect(previewMock.mock.calls.every(call => call[1]?.save === false)).toBe(true);
    expect(listSavedMock).toHaveBeenCalledTimes(1);
    expect(listSavedMock).toHaveBeenCalledWith(DATASET_ID, 'token');

    fireEvent.click(screen.getByRole('button', { name: 'Open report' }));
    await waitFor(() => expect(analyzeMock).toHaveBeenCalled());
    expect(analyzeMock).toHaveBeenCalledWith(
      DATASET_ID,
      'banner_table',
      expect.objectContaining({
        stub_column: 'Q1_Satisfaction',
        banner_column: 'Group',
        letter_upper_alpha: 0.01,
        multiple_comparison: 'fdr',
      })
    );
    expect(openReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'banner_table', sourceDatasetId: DATASET_ID })
    );
  });
});
