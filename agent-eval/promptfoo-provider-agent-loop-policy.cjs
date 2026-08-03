/**
 * Offline policy oracle for post-rewrite Promptfoo suite.
 * Encodes §1.1 mode policy + intended tool routing without calling the LLM.
 * Live endpoint evaluation can replace this provider when API credentials exist.
 */
function classify(prompt, mode) {
  const text = String(prompt || '').trim();
  const m = String(mode || 'agent').toLowerCase();

  const wantsPrep =
    /\b(clean(?:\s+up)?\s+(?:this|the|my)?\s*(?:dataset|data)|prepare\s+(?:this|the|my)?\s*(?:dataset|data)|wrangle|tidy\s+up)\b/i.test(
      text
    );
  const wantsQuality = /(data quality|quality scan|check data issues|scan data)/i.test(text);
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

  // agent
  if (ambiguousFollowUp) return 'clarify';
  if (wantsPrep) return 'start_prep_playbook';
  if (wantsQuality) return 'run_data_quality_scan';
  if (columnDefinition) return 'tool-or-clarify';
  if (wantsAnalysis) return 'run_analysis';
  if (exploratory) return 'tool-or-clarify';
  if (conceptual) return 'text-or-clarify';
  return 'text-or-clarify';
}

module.exports = {
  id: 'tensr-agent-loop-policy',
  async callApi(prompt, context) {
    const mode = context?.vars?.mode || 'agent';
    return { output: classify(prompt, mode) };
  },
};
