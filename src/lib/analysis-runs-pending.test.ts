import { waitForAnalysisRun } from '@/lib/analysis-runs';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    datasets: {
      analyze: {
        get: jest.fn(),
      },
    },
  },
}));

import { apiClient } from '@/lib/api-client';

const get = apiClient.datasets.analyze.get as jest.Mock;

describe('waitForAnalysisRun', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('returns when the pending run becomes complete', async () => {
    get
      .mockResolvedValueOnce({
        id: 'run-1',
        dataset_id: 'ds-1',
        op: 'banner_table',
        created_at: '2026-01-01T00:00:00Z',
        status: 'pending',
        result: {},
        report: {
          meta: { analysis_key: 'banner_table', title: 'Table', generated_at: '', rows_dataset: 0 },
          summary: '',
          metrics: [],
          tables: [],
          trust: { notes: [], warnings: [] },
        },
      })
      .mockResolvedValueOnce({
        id: 'run-1',
        dataset_id: 'ds-1',
        op: 'banner_table',
        created_at: '2026-01-01T00:00:00Z',
        status: 'complete',
        result: { rows: [{ id: 'a' }] },
        report: {
          meta: { analysis_key: 'banner_table', title: 'Table', generated_at: '', rows_dataset: 0 },
          summary: 'ready',
          metrics: [],
          tables: [],
          trust: { notes: [], warnings: [] },
        },
      });

    const run = await waitForAnalysisRun('run-1', { intervalMs: 0, attempts: 5 });
    expect(run?.status).toBe('complete');
    expect(run?.result).toEqual({ rows: [{ id: 'a' }] });
    expect(get).toHaveBeenCalledTimes(2);
  });
});
