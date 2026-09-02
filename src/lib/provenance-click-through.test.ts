import { ViewType, useTabsStore } from '@/stores/tabs-store';
import {
  applyProvenanceRowFilter,
  revealConsumedRowsFromRun,
} from '@/lib/provenance-click-through';
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    datasets: {
      analyze: {
        resolve: jest.fn(),
      },
    },
  },
}));

const mockedResolve = apiClient.datasets.analyze.resolve as jest.Mock;

describe('applyProvenanceRowFilter', () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: '' });
  });

  it('filters the source spreadsheet to exactly those UIDs', () => {
    useTabsStore.getState().addTab({
      name: 'NBA',
      type: ViewType.SPREADSHEET,
      content: '',
      isDirty: false,
      path: 'ds-nba',
      data: {
        datasetId: 'ds-nba',
        filePath: 'ds-nba',
        initialData: [
          { Pos: 'C', _row_uid: 'u1' },
          { Pos: 'SF-PF', _row_uid: 'u2' },
          { Pos: 'PG', _row_uid: 'u3' },
        ],
        totalRows: 3,
      },
    });
    const count = applyProvenanceRowFilter({
      sourceDatasetId: 'ds-nba',
      rowUids: ['u1', 'u3'],
      rows: [
        { Pos: 'C', Age: 26 },
        { Pos: 'PG', Age: 28 },
      ],
    });
    expect(count).toBe(2);
    const sheet = useTabsStore.getState().tabs.find(t => t.type === ViewType.SPREADSHEET);
    expect(sheet?.data?.rowUidFilter).toEqual(['u1', 'u3']);
    expect(sheet?.data?.provenanceOverlayRows).toHaveLength(2);
  });
});

describe('revealConsumedRowsFromRun', () => {
  beforeEach(() => {
    useTabsStore.setState({ tabs: [], activeTabId: '' });
    mockedResolve.mockReset();
  });

  it('resolves complete provenance and applies the UID filter', async () => {
    useTabsStore.getState().addTab({
      name: 'NBA',
      type: ViewType.SPREADSHEET,
      content: '',
      isDirty: false,
      path: 'ds-nba',
      data: { datasetId: 'ds-nba', filePath: 'ds-nba', totalRows: 505 },
    });
    mockedResolve.mockResolvedValue({
      n: 504,
      row_uids: ['a', 'b'],
      rows: [{ Pos: 'C' }, { Pos: 'PG' }],
      origin_dataset_id: 'ds-nba',
    });
    const n = await revealConsumedRowsFromRun({
      runId: 'run-1',
      sourceDatasetId: 'ds-nba',
      provenance: { row_uid_bitset: 'BQ==', row_uid_bitset_miss_count: 0 },
    });
    expect(mockedResolve).toHaveBeenCalledWith('run-1', undefined);
    expect(n).toBe(2);
    const sheet = useTabsStore.getState().tabs.find(t => t.type === ViewType.SPREADSHEET);
    expect(sheet?.data?.rowUidFilter).toEqual(['a', 'b']);
  });

  it('does not call resolve when provenance is not complete', async () => {
    await expect(
      revealConsumedRowsFromRun({
        runId: 'run-1',
        sourceDatasetId: 'ds-nba',
        provenance: { provenance_unavailable: 'multi_origin' },
      })
    ).resolves.toBeNull();
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('does not call resolve when provenance is unknown', async () => {
    await expect(
      revealConsumedRowsFromRun({
        runId: 'run-1',
        sourceDatasetId: 'ds-nba',
        provenance: undefined,
      })
    ).resolves.toBeNull();
    expect(mockedResolve).not.toHaveBeenCalled();
  });
});
