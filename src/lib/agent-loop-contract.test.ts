import { FULL_BASELINE_CONTRACT, expectedContractOutcome } from '@/lib/agent-loop-contract';

describe('full baseline contract (incl. menu-* + category-1/2)', () => {
  it('covers every baseline menu-* and false-positive case', () => {
    const prompts = new Set(FULL_BASELINE_CONTRACT.map(c => c.prompt));
    for (const required of [
      'one-way ANOVA',
      'Could you provide a boxplot for utilisation_rate',
      'What does Age mean?',
      'Where do I start?',
      't test for me on my dataset',
      'Run a data quality scan',
      'sorry it should be age and Tm',
    ]) {
      expect(prompts.has(required)).toBe(true);
    }
  });

  it.each(FULL_BASELINE_CONTRACT)(
    '$mode · $prompt → $expected (was $baselineGate)',
    ({ prompt, mode, expected }) => {
      expect(expectedContractOutcome(prompt, mode)).toBe(expected);
    }
  );

  it('category-1 is direct_text, never a merged bucket', () => {
    expect(expectedContractOutcome('What does Age mean?')).toBe('direct_text');
    expect(expectedContractOutcome('How do I interpret a p-value?')).toBe('direct_text');
  });

  it('category-2 is ask_clarifying_question, never text-or-clarify', () => {
    for (const p of [
      'Hello',
      'run one for me',
      'why is that significant?',
      'Can you help me understand the groups?',
      'sorry it should be age and Tm',
    ]) {
      expect(expectedContractOutcome(p)).toBe('ask_clarifying_question');
    }
  });

  it('reports pass rate against full contract set', () => {
    const results = FULL_BASELINE_CONTRACT.map(c => ({
      ...c,
      actual: expectedContractOutcome(c.prompt, c.mode),
      pass: expectedContractOutcome(c.prompt, c.mode) === c.expected,
    }));
    const failed = results.filter(r => !r.pass);
    expect(failed).toEqual([]);
    expect(results.filter(r => r.pass).length).toBe(FULL_BASELINE_CONTRACT.length);
  });
});
