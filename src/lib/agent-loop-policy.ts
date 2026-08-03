/**
 * Offline policy oracle mirroring agent-eval/promptfoo-provider-agent-loop-policy.cjs
 * for Jest CI (post-rewrite §4.2 expectations without calling the LLM).
 */

export type AgentMode = 'ask' | 'plan' | 'agent';

export type PolicyOutcome =
  | 'text-or-clarify'
  | 'tool-or-clarify'
  | 'clarify'
  | 'run_analysis'
  | 'start_prep_playbook'
  | 'run_data_quality_scan'
  | 'ask-no-write'
  | 'plan-awaiting-approval'
  | 'refuse-or-clarify';

export function classifyAgentLoopPolicy(prompt: string, mode: AgentMode = 'agent'): PolicyOutcome {
  const text = (prompt || '').trim();
  const m = mode;

  const wantsPrep =
    /\b(clean(?:\s+up)?\s+(?:this|the|my)?\s*(?:dataset|data)|prepare\s+(?:this|the|my)?\s*(?:dataset|data)|wrangle|tidy\s+up)\b/i.test(
      text
    );
  const wantsQuality = /(data quality|quality scan|check data issues|scan data)/i.test(text);
  // Column-definition asks ("what does Age mean?") must win over \bmean\b aggregate.
  const columnDefinition = /\bwhat does\b.+\bmean\b/i.test(text);
  const wantsAnalysis =
    !columnDefinition &&
    (/\b(t[\s-]?test|anova|correlation|regression|chi[\s-]?square|descriptives?)\b/i.test(text) ||
      /\b(how many|count|sum|average|mean|median|percentile|quantile|chart|graph|plot|histogram|boxplot)\b/i.test(
        text
      ));
  const ambiguousFollowUp = /^(run one for me|sorry it should be|do that)\b/i.test(text);
  const conceptual =
    /interpret a p-value|why is that significant|help me understand/i.test(text) ||
    /^hello\b/i.test(text);
  const exploratory = /what(?:'s| is) interesting|where do i start|explore/i.test(text);
  const unsupportedStat = /geometric\s+mean|harmonic\s+mean/i.test(text);

  if (unsupportedStat) return 'refuse-or-clarify';

  if (m === 'ask') {
    if (wantsPrep || wantsAnalysis || wantsQuality) return 'ask-no-write';
    return 'text-or-clarify';
  }

  if (m === 'plan') {
    if (wantsPrep || wantsAnalysis || wantsQuality) return 'plan-awaiting-approval';
    if (ambiguousFollowUp) return 'clarify';
    return 'text-or-clarify';
  }

  if (ambiguousFollowUp) return 'clarify';
  if (wantsPrep) return 'start_prep_playbook';
  if (wantsQuality) return 'run_data_quality_scan';
  if (columnDefinition) return 'tool-or-clarify';
  if (wantsAnalysis) return 'run_analysis';
  if (exploratory) return 'tool-or-clarify';
  if (conceptual) return 'text-or-clarify';
  return 'text-or-clarify';
}
