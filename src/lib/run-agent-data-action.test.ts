import {
  dataActionFromIntent,
  isDataActionIntent,
  pendingFilterApplyFromResult,
  shouldRouteMessageToDataIntent,
} from '@/lib/run-agent-data-action';
import { assistantUpdateFromParseIntent } from '@/lib/run-agent-analysis-plan';

describe('shouldRouteMessageToDataIntent', () => {
  it.each([
    'How many members joined after 2024?',
    'Filter rows where Region equals London',
    'Sum of Revenue by Region',
    'Difference between London and Wales revenue',
    'Make a monthly line chart',
    'Create a bar chart of sales',
  ])('routes “%s” to data intent', message => {
    expect(shouldRouteMessageToDataIntent(message)).toBe(true);
  });

  it('does not route pure greetings', () => {
    expect(shouldRouteMessageToDataIntent('Hello there')).toBe(false);
  });
});

describe('parse-intent → data action adapter', () => {
  it('detects action intents and maps auto-execute flags', () => {
    const intent = {
      status: 'plan',
      interpretation: 'Count rows matching the date filter.',
      intent_kind: 'action' as const,
      action_type: 'count',
      action_spec: {
        filters: [{ column: 'joined', operator: 'greaterThan', value: '2024-01-01' }],
      },
      auto_execute: true,
    };

    expect(isDataActionIntent(intent)).toBe(true);
    const action = dataActionFromIntent(intent);
    expect(action?.actionType).toBe('count');
    expect(action?.autoExecute).toBe(true);

    const update = assistantUpdateFromParseIntent(intent, 'Data');
    expect(update.type).toBe('action');
    if (update.type === 'action') {
      expect(update.action.actionType).toBe('count');
    }
  });

  it('builds a confirm-to-apply pending action from filter preview results', () => {
    const pending = pendingFilterApplyFromResult(
      {
        actionType: 'filter_preview',
        spec: {},
        rationale: 'Preview filter',
        autoExecute: true,
      },
      {
        ok: true,
        action_type: 'filter_preview',
        answer_markdown: '**Answer:** 12 of 100 rows match.',
        filters: [{ columnId: 'Region', operator: 'equals', value: 'London' }],
      }
    );

    expect(pending?.kind).toBe('data_action');
    if (pending?.kind === 'data_action') {
      expect(pending.action.actionType).toBe('filter_apply');
      expect(pending.status).toBe('pending');
      expect(pending.action.spec.filters).toEqual([
        { columnId: 'Region', operator: 'equals', value: 'London' },
      ]);
    }
  });
});
