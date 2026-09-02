import {
  canRevealConsumedRows,
  normalizeStoredAnalysisRun,
  provenanceBannerText,
  provenanceTraceState,
  rSyntaxBadgeText,
} from './analysis-runs';

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

  it('keeps stored provenance so reopen can print the three-state', () => {
    const run = normalizeStoredAnalysisRun({
      id: 'run-3',
      dataset_id: '11111111-1111-4111-8111-111111111111',
      op: 'anova_oneway',
      created_at: '2026-01-01T00:00:00.000Z',
      report: {
        meta: {
          analysis_key: 'anova_oneway',
          title: 'One-Way ANOVA',
          subtitle: '',
          generated_at: '2026-01-01T00:00:00.000Z',
          rows_dataset: 10,
        },
        summary: 'Groups differed.',
        metrics: [],
        tables: [],
        trust: { notes: [], warnings: [] },
      },
      result: {},
      provenance: { provenance_unavailable: 'multi_origin' },
    });
    expect(run?.provenance).toEqual({ provenance_unavailable: 'multi_origin' });
  });
});

describe('provenanceTraceState', () => {
  it('treats missing provenance as unknown, not complete', () => {
    expect(provenanceTraceState(undefined)).toEqual({ kind: 'unknown' });
    expect(provenanceTraceState(null)).toEqual({ kind: 'unknown' });
    expect(provenanceTraceState({})).toEqual({ kind: 'unknown' });
  });

  it('stamps unavailable with the stored reason', () => {
    expect(provenanceTraceState({ provenance_unavailable: 'multi_origin' })).toEqual({
      kind: 'unavailable',
      reason: 'multi_origin',
    });
  });

  it('is complete only with a bitset and no misses', () => {
    expect(provenanceTraceState({ row_uid_bitset: 'BQ==', row_uid_bitset_miss_count: 0 })).toEqual({
      kind: 'complete',
    });
  });
});

describe('provenanceBannerText', () => {
  it('prints the Stage 3 unknown sentence', () => {
    expect(provenanceBannerText({ kind: 'unknown' })).toBe(
      'Traceability unknown. This run has no stored provenance. Numbers cannot be traced to the rows they came from.'
    );
  });

  it('prints unavailable with the reason, distinct from unknown', () => {
    expect(provenanceBannerText({ kind: 'unavailable', reason: 'multi_origin' })).toBe(
      'Provenance unavailable: multi_origin. These numbers should not be trusted as a complete row set.'
    );
  });

  it('is silent when the bitset is complete', () => {
    expect(provenanceBannerText({ kind: 'complete' })).toBeNull();
  });
});

describe('canRevealConsumedRows', () => {
  it('is complete-only', () => {
    expect(canRevealConsumedRows(undefined)).toBe(false);
    expect(canRevealConsumedRows({ provenance_unavailable: 'multi_origin' })).toBe(false);
    expect(canRevealConsumedRows({ row_uid_bitset: 'BQ==', row_uid_bitset_miss_count: 0 })).toBe(
      true
    );
  });
});

describe('rSyntaxBadgeText', () => {
  it('treats a missing stamp as unknown, not verified', () => {
    expect(rSyntaxBadgeText(undefined).kind).toBe('unknown');
    expect(rSyntaxBadgeText(undefined).text).toMatch(/unknown/i);
  });

  it('keeps verified, verified_in_ci, and not_verified distinct', () => {
    expect(rSyntaxBadgeText({ kind: 'verified', statement: 'ok' })).toEqual({
      kind: 'verified',
      text: 'ok',
    });
    expect(rSyntaxBadgeText({ kind: 'verified_in_ci', statement: 'ci' }).kind).toBe(
      'verified_in_ci'
    );
    expect(rSyntaxBadgeText({ kind: 'not_verified', statement: 'miss' }).kind).toBe('not_verified');
  });
});
