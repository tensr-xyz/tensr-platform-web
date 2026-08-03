import { classifyAgentLoopPolicy } from '@/lib/agent-loop-policy';

describe('classifyAgentLoopPolicy — post-rewrite §4.2', () => {
  const cases: Array<{ prompt: string; mode: 'ask' | 'plan' | 'agent'; outcome: string }> = [
    { prompt: 'Hello', mode: 'agent', outcome: 'text-or-clarify' },
    { prompt: 'What does Age mean?', mode: 'agent', outcome: 'tool-or-clarify' },
    { prompt: 'How do I interpret a p-value?', mode: 'agent', outcome: 'text-or-clarify' },
    { prompt: 'run one for me', mode: 'agent', outcome: 'clarify' },
    { prompt: 'why is that significant?', mode: 'agent', outcome: 'text-or-clarify' },
    { prompt: 'Can you help me understand the groups?', mode: 'agent', outcome: 'text-or-clarify' },
    { prompt: 't test for me on my dataset', mode: 'agent', outcome: 'run_analysis' },
    { prompt: 'correlation between Age and PTS', mode: 'agent', outcome: 'run_analysis' },
    { prompt: 'How many members joined after 2024?', mode: 'agent', outcome: 'run_analysis' },
    { prompt: 'Sum of Revenue by Region', mode: 'agent', outcome: 'run_analysis' },
    { prompt: 'Make a monthly line chart', mode: 'agent', outcome: 'run_analysis' },
    { prompt: "What's interesting?", mode: 'agent', outcome: 'tool-or-clarify' },
    { prompt: 'Where do I start?', mode: 'agent', outcome: 'tool-or-clarify' },
    { prompt: 'Clean this dataset', mode: 'agent', outcome: 'start_prep_playbook' },
    { prompt: 'Run a data quality scan', mode: 'agent', outcome: 'run_data_quality_scan' },
    {
      prompt: 'I want percentile values for utilisation_rate',
      mode: 'agent',
      outcome: 'run_analysis',
    },
    { prompt: 't test for me on my dataset', mode: 'ask', outcome: 'ask-no-write' },
    { prompt: 'Clean this dataset', mode: 'ask', outcome: 'ask-no-write' },
    { prompt: 't test for me on my dataset', mode: 'plan', outcome: 'plan-awaiting-approval' },
    { prompt: 'geometric mean of Revenue', mode: 'agent', outcome: 'refuse-or-clarify' },
  ];

  it.each(cases)('$mode · $prompt → $outcome', ({ prompt, mode, outcome }) => {
    expect(classifyAgentLoopPolicy(prompt, mode)).toBe(outcome);
  });
});
