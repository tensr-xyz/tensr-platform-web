import {
  analysisRunPollDelay,
  ANALYSIS_RUN_POLL_MAX_MS,
  ANALYSIS_RUN_POLL_MS,
  waitForAnalysisRun,
} from '@/lib/analysis-runs';

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

function runRow(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    dataset_id: 'ds-1',
    op: 'banner_table',
    created_at: '2026-01-01T00:00:00Z',
    status,
    result: {},
    report: {
      meta: { analysis_key: 'banner_table', title: 'Table', generated_at: '', rows_dataset: 0 },
      summary: '',
      metrics: [],
      tables: [],
      trust: { notes: [], warnings: [] },
    },
    ...extra,
  };
}

describe('analysisRunPollDelay', () => {
  it('backs off 1s → 2s → 4s → 8s then caps at 10s', () => {
    expect(analysisRunPollDelay(0)).toBe(ANALYSIS_RUN_POLL_MS);
    expect(analysisRunPollDelay(1)).toBe(2_000);
    expect(analysisRunPollDelay(2)).toBe(4_000);
    expect(analysisRunPollDelay(3)).toBe(8_000);
    expect(analysisRunPollDelay(4)).toBe(ANALYSIS_RUN_POLL_MAX_MS);
    expect(analysisRunPollDelay(5)).toBe(ANALYSIS_RUN_POLL_MAX_MS);
  });
});

describe('waitForAnalysisRun', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('returns when the pending run becomes complete', async () => {
    get.mockResolvedValueOnce(runRow('pending')).mockResolvedValueOnce(
      runRow('complete', {
        result: { rows: [{ id: 'a' }] },
        report: {
          meta: {
            analysis_key: 'banner_table',
            title: 'Table',
            generated_at: '',
            rows_dataset: 0,
          },
          summary: 'ready',
          metrics: [],
          tables: [],
          trust: { notes: [], warnings: [] },
        },
      })
    );

    const run = await waitForAnalysisRun('run-1', { intervalMs: 0, attempts: 5 });
    expect(run?.status).toBe('complete');
    expect(run?.result).toEqual({ rows: [{ id: 'a' }] });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('makes no further requests once the run is finished', async () => {
    get.mockResolvedValue(runRow('complete', { result: { ok: true } }));

    const run = await waitForAnalysisRun('run-1', { intervalMs: 0, attempts: 10 });
    expect(run?.status).toBe('complete');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('stops polling when the run fails', async () => {
    get
      .mockResolvedValueOnce(runRow('pending'))
      .mockResolvedValueOnce(runRow('failed', { result: { error: 'boom' } }));

    const run = await waitForAnalysisRun('run-1', { intervalMs: 0, attempts: 10 });
    expect(run?.status).toBe('failed');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('uses exponential backoff between pending polls', async () => {
    jest.useFakeTimers();
    get
      .mockResolvedValueOnce(runRow('pending'))
      .mockResolvedValueOnce(runRow('pending'))
      .mockResolvedValueOnce(runRow('pending'))
      .mockResolvedValueOnce(runRow('complete'));

    const pending = waitForAnalysisRun('run-1', { attempts: 10 });
    await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(ANALYSIS_RUN_POLL_MS);
    await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(2_000);
    await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(3);

    await jest.advanceTimersByTimeAsync(4_000);
    const run = await pending;
    expect(run?.status).toBe('complete');
    expect(get).toHaveBeenCalledTimes(4);

    jest.useRealTimers();
  });
});
