import {
  clientDeckProgressLine,
  pendingClientDeckFromToolResults,
  resolvePendingClientDeckInResponse,
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
});
