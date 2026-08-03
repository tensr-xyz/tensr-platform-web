/**
 * Labels aligned with FULL_BASELINE_CONTRACT / agent_clarity hard branches.
 * Live tool_trace proof is in tensr-api test_agent_loop_categories.py.
 *
 * Must export a constructor class (promptfoo does `new Provider(...)`).
 */

function classify(prompt, mode) {
  const text = String(prompt || '').trim();
  const m = String(mode || 'agent').toLowerCase();

  const columnDefinition = /\bwhat does\b.+\bmean\b/i.test(text);
  const conceptual = /\binterpret( a| the)? p[- ]?value\b/i.test(text);
  const greeting = /^(hi|hello|hey)\b/i.test(text);
  const ambiguousRun = /^(run one( for me)?|do (that|it|one))\b/i.test(text);
  const ambiguousWhy = /^why is that significant\b/i.test(text);
  const ambiguousGroups = /help me understand the groups/i.test(text);
  const columnReply = /^(sorry[, ]+)?(it )?should be\b/i.test(text);
  const wantsPrep =
    /\b(clean(?:\s+up)?\s+(?:this|the|my)?\s*(?:dataset|data)|prepare|wrangle|tidy\s+up)\b/i.test(
      text
    );
  const wantsQuality = /(data quality|quality scan)/i.test(text);
  const wantsAnalysis =
    !columnDefinition &&
    (/\b(t[\s-]?test|anova|correlation|regression|chi[\s-]?square|descriptives?|boxplot|percentile|how many|count|sum|average|mean|median|chart|graph|plot|histogram)\b/i.test(
      text
    ) ||
      /one-way\s+anova/i.test(text));
  const exploratory = /what(?:'s| is) interesting|where do i start|explore/i.test(text);
  const unsupportedStat = /geometric\s+mean|harmonic\s+mean/i.test(text);

  if (unsupportedStat) return 'refuse-or-clarify';
  if (columnDefinition || conceptual) return 'direct_text';
  if (greeting || ambiguousRun || ambiguousWhy || ambiguousGroups || columnReply) {
    return 'ask_clarifying_question';
  }

  if (m === 'ask') {
    if (wantsPrep || wantsAnalysis || wantsQuality) return 'ask-no-write';
    return 'direct_text';
  }
  if (m === 'plan') {
    if (wantsPrep || wantsAnalysis || wantsQuality) return 'plan-awaiting-approval';
    return 'ask_clarifying_question';
  }

  if (wantsPrep) return 'start_prep_playbook';
  if (wantsQuality) return 'run_data_quality_scan';
  if (wantsAnalysis) return 'run_analysis';
  if (exploratory) return 'tool_or_clarify';
  return 'ask_clarifying_question';
}

module.exports = class TensrAgentLoopPolicyProvider {
  constructor(options) {
    this.providerId = options?.id || 'tensr-agent-loop-policy';
    this.config = options?.config;
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt, context) {
    const mode = context?.vars?.mode || 'agent';
    return { output: classify(prompt, mode) };
  }
};
