import {
  attachApproachToReport,
  chatFieldsAfterRunAnalysis,
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

describe('attachApproachToReport', () => {
  it('adds approach from plan/why without clobbering an existing approach', () => {
    const withApproach = attachApproachToReport(minimalReport(), {
      plan: 'Predict PTS',
      whyThisTest: 'Continuous outcome',
    });
    expect(withApproach?.approach).toEqual({
      plan: 'Predict PTS',
      why_this_test: 'Continuous outcome',
    });

    const kept = attachApproachToReport(
      minimalReport({ approach: { plan: 'Existing', why_this_test: 'Kept' } }),
      { plan: 'New', whyThisTest: 'New why' }
    );
    expect(kept?.approach).toEqual({ plan: 'Existing', why_this_test: 'Kept' });
  });
});
