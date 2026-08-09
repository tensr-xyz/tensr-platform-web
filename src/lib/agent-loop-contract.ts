/**
 * Single source of truth for agent-eval corpora.
 *
 * Jest (`agent-loop-contract.test.ts`) and both Promptfoo configs are derived
 * from FULL_BASELINE_CONTRACT. Regenerate Promptfoo YAML with:
 *   pnpm run generate:agent-eval-promptfoo
 * Drift check (CI):
 *   pnpm run check:agent-eval-promptfoo
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

/** Baseline gate label from the pre-rewrite resolveGate cascade. */
export type BaselineGate =
  | 'tutor'
  | 'data-intent'
  | 'exploratory'
  | 'prep-playbook'
  | 'menu-analysis'
  | 'menu-dialog';

export type BaselineContractCase = {
  prompt: string;
  mode: AgentMode;
  expected: ContractOutcome;
  /** When set, case is included in the Promptfoo routing-baseline corpus. */
  baselineGate?: BaselineGate;
  /** Optional note copied into generated Promptfoo YAML. */
  description?: string;
};

/** Expected post-rewrite outcome for every baseline prompt + category cases. */
export const FULL_BASELINE_CONTRACT: BaselineContractCase[] = [
  // Category 1
  {
    prompt: 'What does Age mean?',
    mode: 'agent',
    expected: 'direct_text',
    baselineGate: 'data-intent',
    description: 'False-positive — \\bmean\\b in aggregate bucket',
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
    description: 'Menu synonym steals before Gate 4',
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
    description: 'Menu label Boxplot steals before Gate 2',
  },
  {
    prompt: 'Run a data quality scan',
    mode: 'agent',
    expected: 'run_data_quality_scan',
    baselineGate: 'menu-dialog',
    description: 'Menu synonym steals before Gate 5',
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
    description: 'False-positive — \\bwhere\\b in filter bucket beats exploratory',
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
  {
    prompt: 'Can we get Percentile Values for these KPIs',
    mode: 'agent',
    expected: 'run_analysis',
    baselineGate: 'data-intent',
  },
  {
    prompt:
      'What are the best levels - top 5%, 10% (or other quartile) levels for utilisation_rate',
    mode: 'agent',
    expected: 'ask_clarifying_question',
    baselineGate: 'data-intent',
    description: 'Gate 2 top/best bucket steals via \\bbest\\b (also matches top 5%)',
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

/** Cases that belong in the Promptfoo routing-baseline corpus. */
export function baselineGateCases(): BaselineContractCase[] {
  return FULL_BASELINE_CONTRACT.filter(c => c.baselineGate != null && c.mode === 'agent');
}
