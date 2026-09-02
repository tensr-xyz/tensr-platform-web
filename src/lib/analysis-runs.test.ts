import { normalizeStoredAnalysisRun } from './analysis-runs';

describe('normalizeStoredAnalysisRun', () => {
  it('keeps a stored report so removed analysis types still open', () => {
    const run = normalizeStoredAnalysisRun({
      id: 'run-1',
      dataset_id: '11111111-1111-4111-8111-111111111111',
      op: 'mcnemar',
      created_at: '2026-01-01T00:00:00.000Z',
      report: {
        meta: {
          analysis_key: 'mcnemar',
          title: 'McNemar Test',
          subtitle: 'a × b',
          generated_at: '2026-01-01T00:00:00.000Z',
          rows_dataset: 40,
        },
        summary: 'Paired proportions differed.',
        metrics: [],
        tables: [{ id: 't', title: 'McNemar', columns: ['χ²'], rows: [['4.2']] }],
        trust: { notes: [], warnings: [] },
      },
      result: { chi2: 4.2 },
    });
    expect(run?.report.summary).toBe('Paired proportions differed.');
    expect(run?.report.tables[0].rows[0][0]).toBe('4.2');
  });

  it('does not drop a retired run that has no report payload', () => {
    const run = normalizeStoredAnalysisRun({
      id: 'run-2',
      dataset_id: '11111111-1111-4111-8111-111111111111',
      op: 'code_open_text',
      created_at: '2026-01-01T00:00:00.000Z',
      result: {},
    });
    expect(run).not.toBeNull();
    expect(run?.report.meta.title).toBe('Open-text coding');
    expect(run?.report.summary).toMatch(/no longer offered/);
  });
});
