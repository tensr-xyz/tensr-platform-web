import { resolveChatAction } from './chat-actions';
import {
  assistantUpdateFromParseIntent,
  pendingActionFromParseIntentUpdate,
} from './run-agent-analysis-plan';

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

describe('assistantUpdateFromParseIntent data actions', () => {
  const menuFallback = {
    op: 'descriptives' as const,
    menuName: 'Descriptives',
    triggerMessage: 'how many rows',
  };

  it('maps count actions and skips pending card when auto-execute', () => {
    const update = assistantUpdateFromParseIntent(
      {
        status: 'plan',
        interpretation: 'Count all rows.',
        intent_kind: 'action',
        action_type: 'count',
        action_spec: {},
        auto_execute: true,
      },
      'Data'
    );
    expect(update.type).toBe('action');
    expect(pendingActionFromParseIntentUpdate(update, menuFallback)).toBeUndefined();
  });

  it('keeps filter_preview as a pending data_action for Apply', () => {
    const update = assistantUpdateFromParseIntent(
      {
        status: 'plan',
        interpretation: 'Preview filter.',
        intent_kind: 'action',
        action_type: 'filter_preview',
        action_spec: {
          filters: [{ column: 'Region', operator: 'equals', value: 'London' }],
        },
        auto_execute: true,
      },
      'Data'
    );
    const pending = pendingActionFromParseIntentUpdate(update, menuFallback);
    expect(pending?.kind).toBe('data_action');
    if (pending?.kind === 'data_action') {
      expect(pending.action.actionType).toBe('filter_preview');
    }
  });

  it('auto-executes explicit descriptives plans (no approval card)', () => {
    const update = assistantUpdateFromParseIntent(
      {
        status: 'plan',
        interpretation: 'Descriptives for PTS.',
        intent_kind: 'analysis',
        analysis_type: 'descriptives',
        request_body: { columns: ['PTS'] },
        auto_execute: true,
      },
      'Descriptives',
      'Give me descriptives for PTS'
    );
    expect(update.type).toBe('plan');
    if (update.type === 'plan') {
      expect(update.autoExecute).toBe(true);
    }
    expect(pendingActionFromParseIntentUpdate(update, menuFallback)).toBeUndefined();
  });

  it('keeps approval for ambiguous group comparisons', () => {
    const update = assistantUpdateFromParseIntent(
      {
        status: 'plan',
        interpretation: 'Compare C vs PG with a t-test.',
        intent_kind: 'analysis',
        analysis_type: 'ttest_independent',
        request_body: {
          group_column: 'Pos',
          value_column: 'PTS',
          group_values: ['C', 'PG'],
        },
        auto_execute: false,
      },
      'Analysis',
      "What's the difference in average points between centers and point guards?"
    );
    expect(update.type).toBe('plan');
    if (update.type === 'plan') {
      expect(update.autoExecute).toBe(false);
    }
    expect(pendingActionFromParseIntentUpdate(update, menuFallback)?.kind).toBe('analysis_plan');
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
