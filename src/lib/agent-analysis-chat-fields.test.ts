import {
  attachApproachToReport,
  chatFieldsAfterRunAnalysis,
  preferRicherPlan,
} from '@/lib/agent-analysis-chat-fields';
import type { AnalysisReport } from '@/lib/analysis-report-types';

function minimalReport(extra?: Partial<AnalysisReport>): AnalysisReport {
  return {
    meta: {
      analysis_key: 'linear_regression',
      title: 'Linear Regression',
      subtitle: 'PTS',
      generated_at: '2026-01-01T00:00:00Z',
      rows_dataset: 100,
    },
    summary: 'OLS summary',
    metrics: [],
    tables: [],
    trust: { notes: [], warnings: [] },
    ...extra,
  };
}

describe('chatFieldsAfterRunAnalysis', () => {
  const reportMd = 'OLS summary\n\n### Linear Regression\n\n**Key results**\n- **R²:** 0.5';

  it('keeps prior Plan/Why in content and report only in resultMarkdown (no dupe)', () => {
    const prior = '**Plan:** Predict PTS\n\n**Why this test:** Linear regression fits.';
    const fields = chatFieldsAfterRunAnalysis({
      priorContent: prior,
      reportMarkdown: reportMd,
    });
    expect(fields.content).toBe(prior);
    expect(fields.resultMarkdown).toBe(reportMd);
    expect(fields.content).not.toBe(fields.resultMarkdown);
  });

  it('does not set identical content and resultMarkdown (live double-render bug)', () => {
    // The broken Approve path set both fields to the same report markdown.
    const fields = chatFieldsAfterRunAnalysis({
      priorContent: reportMd,
      reportMarkdown: reportMd,
    });
    expect(fields.content === fields.resultMarkdown).toBe(false);
    expect(fields.resultMarkdown).toBe(reportMd);
  });

  it('rebuilds Plan/Why from args when prior content was wiped to why alone', () => {
    const fields = chatFieldsAfterRunAnalysis({
      priorContent: '',
      planSummary: 'Predict PTS from Age, MP',
      whyThisTest: 'Linear regression for a continuous outcome',
      reportMarkdown: reportMd,
    });
    expect(fields.content).toContain('**Plan:**');
    expect(fields.content).toContain('**Why this test:**');
    expect(fields.resultMarkdown).toBe(reportMd);
  });

  it('replaces awaiting-approval stub with Plan/Why (not report twice)', () => {
    const fields = chatFieldsAfterRunAnalysis({
      priorContent: 'Paused for approval: Predict PTS from Age, MP',
      planSummary: 'Predict PTS from Age, MP',
      whyThisTest: 'Continuous outcome → linear regression',
      reportMarkdown: reportMd,
    });
    expect(fields.content).toContain('**Plan:**');
    expect(fields.content).toContain('**Why this test:**');
    expect(fields.content).not.toContain('Paused for approval');
    expect(fields.resultMarkdown).toBe(reportMd);
    expect(fields.content).not.toBe(fields.resultMarkdown);
  });
});

describe('preferRicherPlan', () => {
  it('keeps Exploration / Rejected prose over a short rebuild', () => {
    const rich =
      'Predict PTS. Rejected correlation-only. Exploration step 1: Follow-up correlation.';
    expect(preferRicherPlan(rich, 'Predict PTS from Age')).toBe(rich);
    expect(preferRicherPlan('Predict PTS from Age', rich)).toBe(rich);
  });
});

describe('attachApproachToReport', () => {
  it('adds approach from plan/why and merges exploration fields', () => {
    const withApproach = attachApproachToReport(minimalReport(), {
      plan: 'Predict PTS',
      whyThisTest: 'Continuous outcome',
      exploration: 'Step 1 primary\nStep 2 enrichment',
      rejectedAlternative: 'Rejected correlation-only',
    });
    expect(withApproach?.approach).toEqual({
      plan: 'Predict PTS',
      why_this_test: 'Continuous outcome',
      exploration: 'Step 1 primary\nStep 2 enrichment',
      rejected_alternative: 'Rejected correlation-only',
    });

    const merged = attachApproachToReport(
      minimalReport({ approach: { plan: 'Short rebuild', why_this_test: 'Kept' } }),
      {
        plan: 'Short rebuild. Rejected X. Exploration step 1: correlation.',
        whyThisTest: 'New why',
        exploration: 'trace',
      }
    );
    expect(merged?.approach?.plan).toContain('Exploration step');
    expect(merged?.approach?.why_this_test).toBe('New why');
    expect(merged?.approach?.exploration).toBe('trace');
  });
});
