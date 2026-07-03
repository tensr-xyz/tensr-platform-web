import { resolveChatAction } from './chat-actions';
import { assistantUpdateFromParseIntent } from './run-agent-analysis-plan';

describe('assistantUpdateFromParseIntent unsupported fallback', () => {
  it('falls back to resolveChatAction for known analysis phrases', () => {
    const message = "Run Cohen's Kappa comparing rater_a and rater_b";
    const update = assistantUpdateFromParseIntent(
      {
        status: 'unsupported',
        interpretation: 'This request is not supported by the current analysis set.',
      },
      'Analysis',
      message
    );
    expect(update.type).toBe('no_plan');
    if (update.type === 'no_plan') {
      expect(update.menuOverride?.op).toBe('cohens_kappa');
    }
    expect(resolveChatAction(message).kind).toBe('analysis');
  });

  it('returns unsupported when no chat action matches', () => {
    const update = assistantUpdateFromParseIntent(
      { status: 'unsupported', interpretation: 'Nope.' },
      'Analysis',
      'quantum flux capacitor analysis'
    );
    expect(update.type).toBe('unsupported');
  });
});

describe('resolveChatAction new synonyms', () => {
  it('matches independent samples t-test phrasing', () => {
    const action = resolveChatAction(
      'Run an independent samples t-test comparing outcome by group'
    );
    expect(action.kind).toBe('analysis');
    if (action.kind === 'analysis') {
      expect(action.op).toBe('ttest_independent');
    }
  });

  it('matches predicting phrasing to linear regression', () => {
    const action = resolveChatAction('Run a linear regression predicting outcome from x1 and x2');
    expect(action.kind).toBe('analysis');
    if (action.kind === 'analysis') {
      expect(action.op).toBe('linear_regression');
    }
  });
});
