/**
 * Post-rewrite contract scored against the FULL baseline set (incl. menu-*)
 * plus category-1/2 rules. Not a merged "text-or-clarify" oracle.
 */

export type ContractOutcome =
  | 'direct_text'
  | 'ask_clarifying_question'
  | 'run_analysis'
  | 'start_prep_playbook'
  | 'run_data_quality_scan'
  | 'tool_or_clarify'
  | 'ask-no-write'
  | 'plan-awaiting-approval'
  | 'refuse-or-clarify';

export type AgentMode = 'ask' | 'plan' | 'agent';

/** Expected post-rewrite outcome for every baseline prompt + category cases. */
export const FULL_BASELINE_CONTRACT: Array<{
  prompt: string;
  mode: AgentMode;
  expected: ContractOutcome;
  baselineGate?: string;
}> = [
  // Category 1
  {
    prompt: 'What does Age mean?',
    mode: 'agent',
    expected: 'direct_text',
    baselineGate: 'data-intent',
  },
  {
    prompt: 'How do I interpret a p-value?',
    mode: 'agent',
    expected: 'direct_text',
    baselineGate: 'tutor',
  },
  // Category 2
  { prompt: 'Hello', mode: 'agent', expected: 'ask_clarifying_question', baselineGate: 'tutor' },
  {
    prompt: 'run one for me',
    mode: 'agent',
    expected: 'ask_clarifying_question',
    baselineGate: 'tutor',
  },
  {
    prompt: 'why is that significant?',
    mode: 'agent',
    expected: 'ask_clarifying_question',
    baselineGate: 'tutor',
  },
  {
    prompt: 'Can you help me understand the groups?',
    mode: 'agent',
    expected: 'ask_clarifying_question',
    baselineGate: 'tutor',
  },
  {
    prompt: 'sorry it should be age and Tm',
    mode: 'agent',
    expected: 'ask_clarifying_question',
  },
  // Former menu-* / gates
  {
    prompt: 't test for me on my dataset',
    mode: 'agent',
    expected: 'run_analysis',
    baselineGate: 'menu-analysis',
  },
  {
    prompt: 'correlation between Age and PTS',
    mode: 'agent',
    expected: 'run_analysis',
    baselineGate: 'menu-analysis',
  },
  {
    prompt: 'one-way ANOVA',
    mode: 'agent',
    expected: 'run_analysis',
    baselineGate: 'menu-analysis',
  },
  {
    prompt: 'Could you provide a boxplot for utilisation_rate',
    mode: 'agent',
    expected: 'run_analysis',
    baselineGate: 'menu-dialog',
  },
  {
    prompt: 'Run a data quality scan',
    mode: 'agent',
    expected: 'run_data_quality_scan',
    baselineGate: 'menu-dialog',
  },
  {
    prompt: 'How many members joined after 2024?',
    mode: 'agent',
    expected: 'run_analysis',
    baselineGate: 'data-intent',
  },
  {
    prompt: 'Sum of Revenue by Region',
    mode: 'agent',
    expected: 'run_analysis',
    baselineGate: 'data-intent',
  },
  {
    prompt: 'Make a monthly line chart',
    mode: 'agent',
    expected: 'run_analysis',
    baselineGate: 'data-intent',
  },
  {
    prompt: "What's interesting?",
    mode: 'agent',
    expected: 'tool_or_clarify',
    baselineGate: 'exploratory',
  },
  {
    prompt: 'Where do I start?',
    mode: 'agent',
    expected: 'tool_or_clarify',
    baselineGate: 'data-intent',
  },
  {
    prompt: 'Clean this dataset',
    mode: 'agent',
    expected: 'start_prep_playbook',
    baselineGate: 'prep-playbook',
  },
  {
    prompt: 'I want percentile values for utilisation_rate',
    mode: 'agent',
    expected: 'run_analysis',
    baselineGate: 'data-intent',
  },
  // Modes
  { prompt: 't test for me on my dataset', mode: 'ask', expected: 'ask-no-write' },
  { prompt: 'Clean this dataset', mode: 'ask', expected: 'ask-no-write' },
  {
    prompt: 't test for me on my dataset',
    mode: 'plan',
    expected: 'plan-awaiting-approval',
  },
  { prompt: 'geometric mean of Revenue', mode: 'agent', expected: 'refuse-or-clarify' },
];

/**
 * Offline expected-label classifier aligned with agent_clarity hard branches
 * + tool routing intent. Used only to document expected labels for the
 * contract file — live category-1/2 proof lives in tensr-api pytest.
 */
export function expectedContractOutcome(
  prompt: string,
  mode: AgentMode = 'agent'
): ContractOutcome {
  const hit = FULL_BASELINE_CONTRACT.find(c => c.prompt === prompt && c.mode === mode);
  if (hit) return hit.expected;
  return 'tool_or_clarify';
}
