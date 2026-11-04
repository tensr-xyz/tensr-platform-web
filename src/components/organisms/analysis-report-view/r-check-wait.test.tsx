import { act, render, screen } from '@testing-library/react';

import type { AnalysisReport } from '@/lib/analysis-report-types';
import { apiClient } from '@/lib/api-client';
import { R_CHECK_POLL_LIMIT, R_CHECK_POLL_MS, R_CHECK_STILL_AFTER } from '@/lib/analysis-runs';

import { AnalysisReportView } from './index';

function pendingReport(): AnalysisReport {
  return {
    meta: {
      analysis_key: 'descriptives',
      title: 'Descriptives',
      subtitle: 'Q1_top2',
      generated_at: '2026-01-01T00:00:00.000Z',
      rows_dataset: 10,
    },
    summary: 'Mean 0.6.',
    metrics: [],
    tables: [],
    trust: { notes: [], warnings: [] },
    r_syntax_verification: { kind: 'pending', statement: 'R syntax is being checked.' },
  };
}

describe('AnalysisReportView R check wait', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(apiClient.datasets.analyze, 'get').mockResolvedValue({
      id: 'run-1',
      dataset_id: 'ds',
      op: 'descriptives',
      created_at: '2026-01-01T00:00:00.000Z',
      report: pendingReport(),
      result: {},
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('says still checking through a cold start and unavailable only after the full wait', async () => {
    render(<AnalysisReportView report={pendingReport()} analysisRunId="run-1" />);
    const badge = screen.getByTestId('r-syntax-badge');
    expect(badge).toHaveTextContent(/checking r syntax/i);
    expect(badge).not.toHaveTextContent(/unavailable/i);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(R_CHECK_POLL_MS * R_CHECK_STILL_AFTER);
    });
    expect(screen.getByTestId('r-syntax-badge')).toHaveTextContent(/still checking/i);
    expect(screen.getByTestId('r-syntax-badge')).not.toHaveTextContent(/unavailable/i);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(
        R_CHECK_POLL_MS * (R_CHECK_POLL_LIMIT - R_CHECK_STILL_AFTER)
      );
    });
    expect(screen.getByTestId('r-syntax-badge')).toHaveTextContent('R check unavailable');
  });
});
