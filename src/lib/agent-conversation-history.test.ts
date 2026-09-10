import {
  buildAgentConversationHistory,
  lastFittedModelFromToolResults,
  lastFittedModelMarker,
  stripLastFittedModelMarker,
} from './agent-conversation-history';

describe('agent conversation history', () => {
  it('re-attaches the last fitted model marker for the next turn', () => {
    const spec = {
      analysis_type: 'logistic_regression',
      request_body: {
        dependent: 'Full_retention',
        independents: ['Interval', 'Pay'],
        reference_levels: { Interval: 'short', Pay: 'low' },
      },
    };
    const history = buildAgentConversationHistory([
      { role: 'user', content: 'fit the interaction model' },
      {
        role: 'assistant',
        content: 'Binary logistic of Full_retention',
        lastFittedModel: spec,
      },
    ]);
    expect(history[1].content).toContain(lastFittedModelMarker(spec));
  });

  it('strips the hidden marker from displayed chat text', () => {
    const spec = { analysis_type: 'logistic_regression', request_body: { dependent: 'y' } };
    const raw = `Odds ratios\n${lastFittedModelMarker(spec)}`;
    expect(stripLastFittedModelMarker(raw)).toBe('Odds ratios');
  });

  it('reads last_fitted_model from tool results', () => {
    const spec = {
      analysis_type: 'logistic_regression',
      request_body: { dependent: 'Full_retention', independents: ['Interval'] },
    };
    expect(
      lastFittedModelFromToolResults([{ result: { ok: true, last_fitted_model: spec } }])
    ).toEqual(spec);
  });
});
