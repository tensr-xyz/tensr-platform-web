import type { AnalysisReport } from '@/lib/analysis-report-types';
import {
  alternativeRepeatsPlan,
  isRawExecutionTrace,
  reportApproachCopy,
} from '@/lib/report-approach-copy';

const TRACE =
  'Step 1: `run_analysis` | type=linear_regression | role=primary | ok | model=PTS~Age,MP\n' +
  '  why: Points are continuous.\n' +
  'Step 2: `run_analysis` | type=correlation | role=enrichment | ok | columns=PTS,Age,MP\n' +
  '  rejected_alternative: Regress PTS on Age, MP.\n' +
  '  prior_result_id: call_abc123';

function report(approach: AnalysisReport['approach'], sessionTrace?: string): AnalysisReport {
  return {
    meta: {
      analysis_key: 'linear_regression',
      title: 'Linear Regression',
      generated_at: '2026-10-03T00:00:00Z',
      rows_dataset: 572,
    },
    summary: '',
    metrics: [],
    tables: [],
    trust: { notes: [], warnings: [] },
    approach,
    ...(sessionTrace ? { session_trace: sessionTrace } : {}),
  };
}

describe('report approach copy', () => {
  it('recognises the tool trace but not a plain-English narrative', () => {
    expect(isRawExecutionTrace(TRACE)).toBe(true);
    expect(
      isRawExecutionTrace(
        '1. Linear Regression of `PTS` on `Age` and `MP`. The model explains 62% of the variation.'
      )
    ).toBe(false);
  });

  it('treats an alternative that restates the chosen model as a repeat', () => {
    const plan = 'Running linear regression predicting **PTS** from Age, MP, ORB, DRB, AST.';
    expect(
      alternativeRepeatsPlan(
        'Regress PTS on Age, MP, ORB, DRB, AST, leaving the controlled factor out.',
        plan
      )
    ).toBe(true);
    expect(
      alternativeRepeatsPlan(
        'Considered keeping the columns for shot volume as predictors. Not used, because you asked for the effect independent of shot volume.',
        plan
      )
    ).toBe(false);
  });

  it('moves an old raw-trace exploration into technical details', () => {
    const copy = reportApproachCopy(report({ plan: 'Regress PTS on Age.', exploration: TRACE }));
    expect(copy.exploration).toBe('');
    expect(copy.technicalDetails).toContain('role=primary');
  });

  it('keeps the narrative in Exploration and the session trace in technical details', () => {
    const narrative = '1. Linear Regression of `PTS` on `Age`. The model explains 62%.';
    const copy = reportApproachCopy(report({ exploration: narrative }, TRACE));
    expect(copy.exploration).toBe(narrative);
    expect(copy.technicalDetails).toBe(TRACE);
  });

  it('shows the alternative once, in its own section, when the plan also carries it', () => {
    const alt =
      'Considered keeping the columns for shot volume as predictors. Not used, because you asked for the effect independent of shot volume.';
    const copy = reportApproachCopy(
      report({
        plan: `Running linear regression predicting **PTS** from Age, MP. ${alt} Exploration step 1: Then check how PTS, Age, MP correlate with each other.`,
        rejected_alternative: alt,
      })
    );
    expect(copy.plan).not.toContain('Considered keeping');
    expect(copy.plan).toContain('Exploration step 1');
    expect(copy.alternative).toBe(alt);
  });
});

describe('alternativeRepeatsPlan threshold', () => {
  it('flags the "leaving the controlled factor out" restatement and keeps real alternatives', () => {
    const plan = 'Running linear regression predicting **PTS** from Age and MP.';
    expect(
      alternativeRepeatsPlan('Regress PTS on Age and MP, leaving the controlled factor out.', plan)
    ).toBe(true);
    expect(
      alternativeRepeatsPlan(
        'Considered a separate correlation of each predictor with PTS. Not used, because those do not hold the other predictors constant.',
        plan
      )
    ).toBe(false);
  });
});
