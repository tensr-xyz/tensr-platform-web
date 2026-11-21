import {
  applyClientDeckJobSnapshot,
  clientDeckJobIsLive,
  clientDeckProgressLine,
  pendingClientDeckFromToolResults,
  resolvePendingClientDeckInResponse,
  watchClientDeckJobInBackground,
} from '@/lib/client-deck-job';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    datasets: {
      clientDeckJob: jest.fn(),
    },
  },
}));

import { apiClient } from '@/lib/api-client';

const clientDeckJob = apiClient.datasets.clientDeckJob as jest.Mock;

describe('client-deck-job', () => {
  beforeEach(() => {
    clientDeckJob.mockReset();
  });

  it('finds a pending build_client_deck job', () => {
    const found = pendingClientDeckFromToolResults([
      {
        name: 'build_client_deck',
        result: {
          pending: true,
          status: 'pending',
          procedure: 'build_client_deck',
          job_id: 'job-1',
          dataset_id: 'ds-1',
        },
      },
    ]);
    expect(found).toEqual({ datasetId: 'ds-1', jobId: 'job-1', entryIndex: 0 });
  });

  it('finds a running deck job even when pending is missing (reopened chat)', () => {
    const found = pendingClientDeckFromToolResults([
      {
        name: 'build_client_deck',
        result: {
          status: 'running',
          stage: 'tables',
          tables_done: 9,
          tables_total: 23,
          procedure: 'build_client_deck',
          job_id: 'job-run',
          dataset_id: 'ds-run',
        },
      },
    ]);
    expect(found).toEqual({ datasetId: 'ds-run', jobId: 'job-run', entryIndex: 0 });
  });

  it('does not poll a finished deck job', () => {
    expect(
      pendingClientDeckFromToolResults([
        {
          name: 'build_client_deck',
          result: {
            pending: false,
            status: 'complete',
            procedure: 'build_client_deck',
            job_id: 'job-done',
            dataset_id: 'ds-done',
          },
        },
      ])
    ).toBeNull();
  });

  it('progress lines stay plain and numbered', () => {
    expect(
      clientDeckProgressLine({
        status: 'running',
        stage: 'tables',
        tables_done: 4,
        tables_total: 12,
      })
    ).toBe('Computing tables 4 of 12');
    expect(clientDeckProgressLine({ status: 'running', stage: 'narrative' })).toBe(
      'Writing insights'
    );
    expect(
      clientDeckProgressLine({
        status: 'running',
        stage: 'narrative',
        message: 'Writing insights 5 of 12',
        insights_done: 5,
        insights_total: 12,
      })
    ).toBe('Writing insights 5 of 12');
    expect(
      clientDeckProgressLine({
        status: 'running',
        stage: 'tables',
        tables_done: 5,
        tables_total: 23,
        n_saved_tables: 30,
      })
    ).toBe('Computing tables 5 of 23; 30 saved tables including 7 insight crosstabs');
    expect(
      clientDeckProgressLine({
        status: 'running',
        stage: 'narrative',
        message: 'Resuming the deck build',
        insights_done: 0,
        insights_total: 12,
      })
    ).toBe('Resuming the deck build');
  });

  it('resolves a completed job into a download without inventing a file when missing', async () => {
    clientDeckJob.mockResolvedValueOnce({
      status: 'complete',
      result: {
        ok: true,
        key: 'exports/excel/x/client-deck.pptx',
        filename: 'client-deck.pptx',
        report_pages: 5,
        n_questions: 3,
        n_insights: 2,
      },
    });

    const out = await resolvePendingClientDeckInResponse(
      {
        status: 'ok',
        mode: 'agent',
        answer_markdown: 'Computing tables 1 of 3',
        tool_results: [
          {
            name: 'build_client_deck',
            result: {
              pending: true,
              job_id: 'job-9',
              dataset_id: 'ds-9',
              procedure: 'build_client_deck',
            },
          },
        ],
      },
      { datasetId: 'ds-9' }
    );

    expect(out.answer_markdown).toContain('PowerPoint: client-deck.pptx');
    expect(out.tool_results?.[0]?.result?.exports).toMatchObject({
      key: 'exports/excel/x/client-deck.pptx',
    });
    const withDownloads = out.tool_results?.[0] as { downloads?: Array<{ key: string }> };
    expect(withDownloads.downloads?.[0]?.key).toBe('exports/excel/x/client-deck.pptx');
  });

  it('keeps pending answer without a PowerPoint line when the job is still running', async () => {
    clientDeckJob.mockResolvedValue({
      status: 'running',
      stage: 'pptx',
      message: 'Building the PowerPoint file',
      report_pages: 4,
    });

    const out = await resolvePendingClientDeckInResponse(
      {
        status: 'ok',
        mode: 'agent',
        answer_markdown: 'Building',
        tool_results: [
          {
            name: 'build_client_deck',
            result: {
              pending: true,
              job_id: 'job-2',
              dataset_id: 'ds-2',
            },
          },
        ],
      },
      { datasetId: 'ds-2', signal: AbortSignal.timeout(10) }
    );

    expect(out.answer_markdown || '').not.toContain('PowerPoint:');
    expect(out.tool_results?.[0]?.result?.pending).toBe(true);
  });

  it('returns pending quickly without long-polling so chat follow-ups are not blocked', async () => {
    clientDeckJob.mockResolvedValue({
      status: 'running',
      stage: 'tables',
      tables_done: 15,
      tables_total: 31,
      report_pages: 12,
    });

    const started = Date.now();
    const out = await resolvePendingClientDeckInResponse(
      {
        status: 'ok',
        mode: 'agent',
        answer_markdown: 'Computing tables 15 of 31',
        tool_results: [
          {
            name: 'build_client_deck',
            result: {
              pending: true,
              job_id: 'job-stall',
              dataset_id: 'ds-stall',
              procedure: 'build_client_deck',
            },
          },
        ],
      },
      { datasetId: 'ds-stall' }
    );
    expect(Date.now() - started).toBeLessThan(5000);
    expect(clientDeckJob.mock.calls.length).toBeLessThanOrEqual(2);
    expect(out.tool_results?.[0]?.result?.pending).toBe(true);
    expect(out.answer_markdown || '').toMatch(/Computing tables 15 of 31/);
    expect(out.answer_markdown || '').not.toMatch(/Ask me to continue/i);
    expect(out.answer_markdown || '').not.toContain('PowerPoint:');
  });

  it('running snapshots stay on progress without asking to continue', () => {
    const pending = {
      status: 'ok' as const,
      mode: 'agent' as const,
      answer_markdown: 'Building',
      tool_results: [
        {
          name: 'build_client_deck',
          result: {
            pending: true,
            job_id: 'job-run',
            dataset_id: 'ds-run',
            procedure: 'build_client_deck',
          },
        },
      ],
    };
    const out = applyClientDeckJobSnapshot(pending, {
      status: 'running',
      stage: 'narrative',
      report_pages: 24,
      message: 'Writing insights',
      insights_done: 3,
      insights_total: 12,
      tables_done: 23,
      tables_total: 23,
    });
    expect(out.answer_markdown || '').toContain('Writing insights');
    expect(out.answer_markdown || '').toContain('Report pages: 24');
    expect(out.answer_markdown || '').not.toMatch(/Ask me to continue/i);
    const result = out.tool_results?.[0]?.result as Record<string, unknown>;
    expect(result.stage).toBe('narrative');
    expect(result.status).toBe('running');
    expect(result.insights_done).toBe(3);
    expect(result.tables_done).toBe(23);
  });

  it('failed jobs with saved tables ask to continue and resume', async () => {
    clientDeckJob.mockResolvedValueOnce({
      status: 'failed',
      stage: 'tables',
      tables_done: 15,
      tables_total: 31,
      error: 'The deck build stopped before it finished',
      report_pages: 12,
    });

    const out = await resolvePendingClientDeckInResponse(
      {
        status: 'ok',
        mode: 'agent',
        answer_markdown: 'Computing tables 15 of 31',
        tool_results: [
          {
            name: 'build_client_deck',
            result: {
              pending: true,
              job_id: 'job-f',
              dataset_id: 'ds-f',
            },
          },
        ],
      },
      { datasetId: 'ds-f' }
    );

    expect(out.answer_markdown || '').toMatch(/continue/i);
    expect(out.answer_markdown || '').toMatch(/resume/i);
    expect(out.answer_markdown || '').not.toContain('PowerPoint:');
    expect(out.tool_results?.[0]?.result?.ok).toBe(false);
    expect(out.tool_results?.[0]?.result?.tables_done).toBe(15);
  });

  it('background watch refreshes chat and report pages when the job finishes', async () => {
    clientDeckJob
      .mockResolvedValueOnce({
        status: 'running',
        stage: 'tables',
        tables_done: 5,
        tables_total: 10,
        report_pages: 4,
      })
      .mockResolvedValueOnce({
        status: 'complete',
        result: {
          ok: true,
          key: 'exports/excel/x/client-deck.pptx',
          filename: 'client-deck.pptx',
          report_pages: 12,
          n_saved_tables: 8,
          n_questions: 8,
          n_insights: 4,
        },
      });

    const pages: number[] = [];
    const updates: string[] = [];
    const pending = {
      status: 'ok' as const,
      mode: 'agent' as const,
      answer_markdown: 'Computing tables 5 of 10',
      tool_results: [
        {
          name: 'build_client_deck',
          result: {
            pending: true,
            job_id: 'job-watch',
            dataset_id: 'ds-watch',
            procedure: 'build_client_deck',
            report_pages: 2,
          },
        },
      ],
    };

    const out = await watchClientDeckJobInBackground(pending, {
      datasetId: 'ds-watch',
      onReportPages: n => pages.push(n),
      onUpdate: next => updates.push(String(next.answer_markdown || '')),
    });

    expect(pages[0]).toBe(2);
    expect(pages).toContain(4);
    expect(pages).toContain(12);
    expect(out.answer_markdown || '').toContain('PowerPoint: client-deck.pptx');
    expect(out.answer_markdown || '').toContain('Saved tables: 8');
    expect(updates.some(line => line.includes('PowerPoint:'))).toBe(true);
    expect(
      applyClientDeckJobSnapshot(pending, { status: 'running', report_pages: 3 }).tool_results?.[0]
        ?.result?.pending
    ).toBe(true);
  });

  it('background watch updates chat when tables_total appears with zero report pages', async () => {
    clientDeckJob
      .mockResolvedValueOnce({
        status: 'running',
        stage: 'tables',
        tables_done: 0,
        tables_total: 0,
        message: 'Computing tables',
        report_pages: 0,
      })
      .mockResolvedValueOnce({
        status: 'running',
        stage: 'tables',
        tables_done: 0,
        tables_total: 7,
        message: 'Computing tables 0 of 7',
        report_pages: 0,
      })
      .mockResolvedValueOnce({
        status: 'failed',
        stage: 'tables',
        tables_done: 0,
        tables_total: 7,
        error: 'The deck build never started computing tables',
        report_pages: 0,
      });

    const updates: string[] = [];
    const pending = {
      status: 'ok' as const,
      mode: 'agent' as const,
      answer_markdown: 'Starting the deck build',
      tool_results: [
        {
          name: 'build_client_deck',
          result: {
            pending: true,
            job_id: 'job-zero',
            dataset_id: 'ds-zero',
            procedure: 'build_client_deck',
            report_pages: 0,
          },
        },
      ],
    };

    const out = await watchClientDeckJobInBackground(pending, {
      datasetId: 'ds-zero',
      onUpdate: next => updates.push(String(next.answer_markdown || '')),
    });

    expect(updates.some(line => /Computing tables 0 of 7/.test(line))).toBe(true);
    expect(out.answer_markdown || '').toMatch(/continue/i);
    expect(out.answer_markdown || '').not.toContain('PowerPoint:');
  });

  it('background watch fails when progress is frozen for the no-progress window', async () => {
    clientDeckJob.mockResolvedValue({
      status: 'running',
      stage: 'tables',
      tables_done: 0,
      tables_total: 23,
      message: 'Computing tables 0 of 23',
      report_pages: 0,
    });

    const pending = {
      status: 'ok' as const,
      mode: 'agent' as const,
      answer_markdown: 'Computing tables 0 of 23',
      tool_results: [
        {
          name: 'build_client_deck',
          result: {
            pending: true,
            job_id: 'job-stuck',
            dataset_id: 'ds-stuck',
            procedure: 'build_client_deck',
            report_pages: 0,
          },
        },
      ],
    };

    const { waitForClientDeckJob } = await import('./client-deck-job');
    const out = await waitForClientDeckJob('ds-stuck', 'job-stuck', {
      intervalMs: 5,
      attempts: 8,
      noProgressMs: 15,
    });

    expect(out?.status).toBe('failed');
    expect(String(out?.error || out?.message || '')).toMatch(/0 of 23/);
    expect(String(out?.error || out?.message || '')).toMatch(/two minutes|continue/i);
    // Keep the pending helper unused warning quiet by asserting the fixture shape.
    expect(pending.tool_results[0].result.job_id).toBe('job-stuck');
  });

  it('never treats a job as stalled while updated_at is under 60s', async () => {
    const now = Date.now();
    const updatedAt = new Date(now - 20_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    clientDeckJob.mockResolvedValue({
      status: 'running',
      stage: 'tables',
      tables_done: 9,
      tables_total: 23,
      message: 'Computing tables 9 of 23',
      updated_at: updatedAt,
    });

    expect(
      clientDeckJobIsLive(
        {
          status: 'running',
          updated_at: updatedAt,
        },
        now
      )
    ).toBe(true);

    const { waitForClientDeckJob } = await import('./client-deck-job');
    const out = await waitForClientDeckJob('ds-live', 'job-live', {
      intervalMs: 5,
      attempts: 6,
      noProgressMs: 10,
    });
    expect(out?.status).toBe('running');
    expect(String(out?.message || '')).toMatch(/Computing tables 9 of 23/);
  });

  it('finished answer shows slide count and exec preview bullets', () => {
    const out = applyClientDeckJobSnapshot(
      {
        status: 'ok',
        mode: 'agent',
        answer_markdown: 'Building',
        tool_results: [
          {
            name: 'build_client_deck',
            result: {
              pending: true,
              job_id: 'job-done',
              dataset_id: 'ds-done',
              procedure: 'build_client_deck',
            },
          },
        ],
      },
      {
        status: 'complete',
        result: {
          ok: true,
          key: 'exports/excel/x/client-deck.pptx',
          filename: 'client-deck.pptx',
          report_pages: 38,
          n_slides: 38,
          n_insights: 12,
          n_questions: 23,
          exec_summary_preview: [
            'Dietitians are more likely to recommend whole foods.',
            'Most stay informed through professional networks.',
          ],
        },
      }
    );
    expect(out.answer_markdown).toContain('Done · 38 slides');
    expect(out.answer_markdown).toContain('• Dietitians are more likely to recommend whole foods.');
    expect(out.answer_markdown).toContain('Open in Report');
    expect(out.tool_results?.[0]?.result?.run_id).toBe('job-done');
  });
});
