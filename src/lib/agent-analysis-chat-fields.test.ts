import {
  attachApproachToReport,
  chatFieldsAfterRunAnalysis,
  preferRicherPlan,
  priorPlanForResult,
  reportCardForOpenedTab,
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

  it('keeps a grounded answer under the plan line', () => {
    const fields = chatFieldsAfterRunAnalysis({
      priorContent: '**Plan:** Chi-square on the same stub and banner, with the same weight.',
      planSummary: 'Chi-square on the same stub and banner, with the same weight.',
      whyThisTest: 'Chi-square on the same stub and banner, with the same weight.',
      reportMarkdown: reportMd,
      answerMarkdown:
        'Rao-Scott chi-square: F = 1.200, df = 3.0, p = 0.310. This is not significant at 0.05.',
    });
    expect(fields.content).toContain('**Plan:**');
    expect(fields.content).toContain('not significant at 0.05');
    expect(fields.resultMarkdown).toBe(reportMd);
  });

  it('does not repeat the plan sentence when it is also the answer', () => {
    const plan = 'Chi-square on the same stub and banner, with the same weight.';
    const fields = chatFieldsAfterRunAnalysis({
      priorContent: `**Plan:** ${plan}`,
      whyThisTest: plan,
      reportMarkdown: reportMd,
      answerMarkdown: plan,
    });
    expect(fields.content.match(/Chi-square on the same stub/g)).toHaveLength(1);
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

describe('reportCardForOpenedTab', () => {
  it('returns a short card when a report tab opened', () => {
    expect(
      reportCardForOpenedTab({
        tabId: 'tab-1',
        title: 'Linear Regression',
        summary: 'Age and minutes predict points.',
      })
    ).toEqual({
      tabId: 'tab-1',
      title: 'Linear Regression',
      summary: 'Age and minutes predict points.',
    });
  });

  it('returns null when no tab opened so chat can keep the full markdown', () => {
    expect(reportCardForOpenedTab({ tabId: null, title: 'Linear Regression' })).toBeNull();
  });
});

describe('priorPlanForResult', () => {
  const pipeline = {
    rationale: 'Import prolific_profile.csv as the profile file.',
    whyThisTest: 'Attach the uploaded profile.',
    pipelineSteps: [
      {
        name: 'import_file',
        args: { role: 'profile' },
        rationale: 'Import prolific_profile.csv as the profile file.',
        why_this_test: 'Attach the uploaded profile.',
      },
      {
        name: 'run_analysis',
        args: { analysis_type: 'merge_datasets' },
        rationale: 'Merge on participant_id.',
      },
      {
        name: 'run_analysis',
        args: { analysis_type: 'banner_table' },
        rationale: 'Banner table of Q5 by gender, age_band.',
        why_this_test: 'Column percentages with letters.',
      },
      {
        name: 'run_analysis',
        args: { analysis_type: 'banner_table' },
        rationale: 'Banner table of Q6 by gender, age_band.',
      },
    ],
  };

  it("takes the banner step's text, not step 1's import text", () => {
    expect(priorPlanForResult(pipeline, 'banner_table')).toEqual({
      plan: 'Banner table of Q5 by gender, age_band.',
      whyThisTest: 'Column percentages with letters.',
    });
    expect(priorPlanForResult(pipeline, 'banner_table', 1).plan).toBe(
      'Banner table of Q6 by gender, age_band.'
    );
  });

  it('returns nothing for a type the pipeline did not plan', () => {
    expect(priorPlanForResult(pipeline, 'linear_regression')).toEqual({
      plan: null,
      whyThisTest: null,
    });
  });

  it('keeps the single-step pending rationale', () => {
    expect(
      priorPlanForResult({ rationale: 'Predict PTS.', whyThisTest: 'OLS.' }, 'linear_regression')
    ).toEqual({ plan: 'Predict PTS.', whyThisTest: 'OLS.' });
    expect(priorPlanForResult(null, 'banner_table')).toEqual({ plan: null, whyThisTest: null });
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
