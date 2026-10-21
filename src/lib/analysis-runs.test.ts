import {
  analysisEnvelopeFromStoredRun,
  canRevealConsumedRows,
  displayedProvenance,
  normalizeStoredAnalysisRun,
  provenanceBannerText,
  provenanceTraceState,
  storedRunIdToHydrate,
  rSyntaxBadgeText,
  sourceRowsUsedLabel,
} from './analysis-runs';
import type { StoredAnalysisRun } from './analysis-runs';

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

  it('does not drop a live run that has no report payload', () => {
    const run = normalizeStoredAnalysisRun({
      id: 'run-2',
      dataset_id: '11111111-1111-4111-8111-111111111111',
      op: 'mcnemar',
      created_at: '2026-01-01T00:00:00.000Z',
      result: {},
    });
    expect(run).not.toBeNull();
    expect(run?.report.meta.title).toMatch(/McNemar/);
    expect(run?.report.summary).toMatch(/no stored report/);
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
    expect(
      provenanceTraceState({
        provenance_scope: 'per_origin',
        origin_bitsets: { en: { hit_count: 2 }, fr: { hit_count: 1 } },
      })
    ).toEqual({ kind: 'complete' });
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
      'This table combines more than one file. Some rows are not cited against a source file, so the trace is incomplete.'
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

describe('sourceRowsUsedLabel', () => {
  it('prints N of M source rows used', () => {
    expect(sourceRowsUsedLabel({ rows_used: 504, rows_total: 505 })).toBe(
      '504 of 505 source rows used'
    );
    expect(sourceRowsUsedLabel(undefined)).toBeNull();
  });
});

describe('analysisEnvelopeFromStoredRun', () => {
  it('keeps the stored provenance, including a derived dataset and its parent', () => {
    const stored = {
      id: 'run-derived',
      dataset_id: 'dcc32017',
      op: 'descriptives',
      created_at: '2026-10-20T00:00:00.000Z',
      report: { meta: { title: 'Descriptives' } },
      result: { statistics_block: { 'N Valid': 258, 'N Missing': 42 } },
      provenance: {
        dataset_id: 'dcc32017',
        parent_dataset_id: 'fc7decc1',
        row_uid_bitset: 'BQ==',
        row_uid_bitset_miss_count: 0,
      },
      body: { columns: ['Q1_top2'] },
    } as StoredAnalysisRun;
    const envelope = analysisEnvelopeFromStoredRun(stored, { ok: true });
    expect(envelope.provenance).toEqual(stored.provenance);
    expect(envelope.run_id).toBe('run-derived');
    expect(provenanceTraceState(envelope.provenance).kind).toBe('complete');
  });

  it('uses the stamp on the stored result when the wrapper has none', () => {
    const stamp = {
      dataset_id: 'child',
      parent_dataset_id: 'parent',
      row_uid_bitset: 'BQ==',
      row_uid_bitset_miss_count: 0,
    };
    expect(displayedProvenance({}, { provenance: stamp })).toEqual(stamp);
    expect(displayedProvenance([stamp])).toEqual(stamp);
    expect(provenanceTraceState(displayedProvenance({}, { provenance: stamp })).kind).toBe(
      'complete'
    );
    const run = normalizeStoredAnalysisRun({
      id: 'run-freq',
      dataset_id: 'child',
      op: 'frequencies',
      created_at: '2026-10-21T00:00:00.000Z',
      report: { meta: { title: 'Frequency table' } },
      result: { provenance: stamp },
    });
    expect(run?.provenance).toEqual(stamp);
  });
});

describe('storedRunIdToHydrate', () => {
  it('loads a frequencies stream that names the procedure instead of run_analysis', () => {
    expect(
      storedRunIdToHydrate({
        name: 'frequencies',
        analysis_type: 'frequencies',
        run_id: 'run-freq',
      })
    ).toBe('run-freq');
    expect(
      storedRunIdToHydrate({
        name: 'run_analysis',
        run_id: 'run-1',
        result: { result: { ok: true } },
      })
    ).toBeNull();
    expect(storedRunIdToHydrate({ name: 'run_analysis', run_id: 'run-1' })).toBe('run-1');
    expect(
      storedRunIdToHydrate({
        name: 'run_analysis',
        result: { run_id: 'run-nested' },
      })
    ).toBe('run-nested');
    expect(
      storedRunIdToHydrate({
        name: 'frequencies',
        run_id: 'run-named',
      })
    ).toBe('run-named');
    expect(
      storedRunIdToHydrate({
        name: 'ask_clarifying_question',
        run_id: 'run-question',
      })
    ).toBeNull();
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
