import { render, screen, waitFor } from '@testing-library/react';
import { AnalysisReportLayout } from '@/components/organisms/analysis-report-layout';
import { apiClient } from '@/lib/api-client';
import {
  formatRunLabel,
  normalizeAnalysisRunSummary,
  openAnalysisRunById,
} from '@/lib/analysis-runs';
import { useTabsStore } from '@/stores/tabs-store';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    datasets: {
      analyze: {
        get: jest.fn(),
        listRuns: jest.fn(),
      },
    },
    reportComments: {
      list: jest.fn().mockResolvedValue({ comments: [] }),
    },
  },
}));

const RUN_ID = 'run-banner-1';
const DATASET_ID = '1b401802-7ee5-42f5-9144-6f37bc084e42';
const TITLE = 'Q7, gender, age × source_wave';

const summaryRow = {
  id: RUN_ID,
  dataset_id: DATASET_ID,
  op: 'banner_table',
  created_at: '2026-10-26T12:00:00.000Z',
  status: 'complete',
  title: TITLE,
};

const fullRun = {
  ...summaryRow,
  body: {
    stubs: [{ column: 'Q7' }, { column: 'gender' }, { column: 'age' }],
    banner_column: 'source_wave',
  },
  result: {
    exports: {
      download: {
        filename: 'banner.xlsx',
        media_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        excel_base64: 'QQ==',
      },
    },
  },
  report: {
    meta: {
      analysis_key: 'banner_table',
      title: TITLE,
      subtitle: TITLE,
      generated_at: '2026-10-26T12:00:00.000Z',
      rows_dataset: 900,
    },
    summary: 'Column percentages by source wave.',
    metrics: [],
    tables: [
      {
        id: 'banner_table',
        title: TITLE,
        columns: ['', 'cars_EN'],
        rows: [['Agree', '40%']],
      },
    ],
    trust: { notes: [], warnings: [] },
  },
};

describe('open a saved banner from a /runs summary', () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: null });
    jest.mocked(apiClient.datasets.analyze.get).mockReset();
    jest.mocked(apiClient.datasets.analyze.listRuns).mockReset();
    jest.mocked(apiClient.datasets.analyze.get).mockResolvedValue(fullRun);
    jest.mocked(apiClient.datasets.analyze.listRuns).mockResolvedValue({
      dataset_id: DATASET_ID,
      runs: [summaryRow],
    });
  });

  it('fetches the full run once and renders the report title once', async () => {
    const listed = normalizeAnalysisRunSummary(summaryRow);
    expect(listed?.title).toBe(TITLE);
    expect(formatRunLabel(listed!)).toBe(TITLE);
    expect(summaryRow).not.toHaveProperty('report');

    const opened = await openAnalysisRunById(RUN_ID);
    expect(opened).toBe(true);
    expect(apiClient.datasets.analyze.get).toHaveBeenCalledTimes(1);
    expect(apiClient.datasets.analyze.get).toHaveBeenCalledWith(RUN_ID);

    const tab = useTabsStore.getState().tabs.find(item => item.data?.analysisRunId === RUN_ID);
    expect(tab?.name).toBe(TITLE);
    expect(tab?.data?.analysisReport).toBeTruthy();

    let renders = 0;
    function CountedLayout() {
      renders += 1;
      return (
        <AnalysisReportLayout
          report={tab!.data!.analysisReport}
          rawResult={tab!.data!.analysisResult as Record<string, unknown>}
          sourceDatasetId={DATASET_ID}
          analysisOp="banner_table"
          analysisRunId={RUN_ID}
          analysisParameters={fullRun.body}
        />
      );
    }

    render(<CountedLayout />);

    await waitFor(() => {
      expect(screen.getByText('Agree')).toBeInTheDocument();
    });
    expect(screen.getAllByText(TITLE).length).toBeGreaterThan(0);
    expect(renders).toBeLessThan(20);
    expect(document.querySelector('.min-w-0.overflow-y-auto')).not.toBeNull();
    expect(screen.getByTestId('report-excel-download')).toBeInTheDocument();
  });
});
