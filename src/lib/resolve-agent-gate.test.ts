import { resolveGateInOrder } from '@/lib/resolve-agent-gate';

/**
 * Baseline corpus — documents the FULL live cascade including menu dispatch.
 * Expected values are the probed actual outcomes (option 1), not the original
 * build-spec YAML guesses that ignored resolveChatAction.
 */
describe('resolveGateInOrder — baseline cascade (before agent-loop rewrite)', () => {
  const cases: Array<{ prompt: string; gate: string }> = [
    { prompt: 'Hello', gate: 'tutor' },
    // False-positive: \bmean\b in aggregate bucket
    { prompt: 'What does Age mean?', gate: 'data-intent' },
    { prompt: 'How do I interpret a p-value?', gate: 'tutor' },
    { prompt: 'run one for me', gate: 'tutor' },
    { prompt: 'why is that significant?', gate: 'tutor' },
    { prompt: 'Can you help me understand the groups?', gate: 'tutor' },
    // Menu steals before Gate 4
    { prompt: 't test for me on my dataset', gate: 'menu-analysis' },
    { prompt: 'How many members joined after 2024?', gate: 'data-intent' },
    { prompt: 'Sum of Revenue by Region', gate: 'data-intent' },
    { prompt: 'Make a monthly line chart', gate: 'data-intent' },
    { prompt: "What's interesting?", gate: 'exploratory' },
    // False-positive: \bwhere\b in filter bucket beats exploratory
    { prompt: 'Where do I start?', gate: 'data-intent' },
    { prompt: 'Clean this dataset', gate: 'prep-playbook' },
    // Menu steals before Gate 5
    { prompt: 'Run a data quality scan', gate: 'menu-dialog' },
    { prompt: 'correlation between Age and PTS', gate: 'menu-analysis' },
    // Screenshot / fidelity regression phrases (routing layer only)
    { prompt: 'I want percentile values for utilisation_rate', gate: 'data-intent' },
    { prompt: 'Can we get Percentile Values for these KPIs', gate: 'data-intent' },
    // Gate 2 top/best bucket: \bbest\b (also leftmost before "top 5%")
    {
      prompt:
        'What are the best levels - top 5%, 10% (or other quartile) levels for utilisation_rate',
      gate: 'data-intent',
    },
    // Inline chart routing skips the Boxplot menu dialog
    { prompt: 'Could you provide a boxplot for utilisation_rate', gate: 'data-intent' },
    { prompt: 'one-way ANOVA', gate: 'menu-analysis' },
  ];

  it.each(cases)('$prompt → $gate', ({ prompt, gate }) => {
    expect(resolveGateInOrder(prompt)).toBe(gate);
  });

  it('Gate 5 skipped without activeTab.data → tutor (when not menu-stolen)', () => {
    // Phrase that hits DQ regex but not menu synonym "data quality"
    expect(resolveGateInOrder('check data issues please', { hasActiveTabData: false })).toBe(
      'tutor'
    );
  });

  it('without datasetId, gates that require it fall through to tutor', () => {
    expect(resolveGateInOrder('Clean this dataset', { hasDatasetId: false })).toBe('tutor');
    expect(resolveGateInOrder("What's interesting?", { hasDatasetId: false })).toBe('tutor');
  });
});
