/**
 * Fail if classifyHeuristic() disagrees with FULL_BASELINE_CONTRACT for any
 * generated case. Keeps the offline oracle aligned with the TS source table.
 *
 * Usage: node agent-eval/check-policy-oracle.cjs
 */
const contract = require('./baseline-contract.generated.json');
const { classifyHeuristic } = require('./promptfoo-provider-agent-loop-policy.cjs');

const failures = [];
for (const c of contract.cases || []) {
  const actual = classifyHeuristic(c.prompt, c.mode);
  if (actual !== c.expected) {
    failures.push({ ...c, actual });
  }
}

if (failures.length) {
  console.error(
    `Policy oracle heuristic drifted from FULL_BASELINE_CONTRACT (${failures.length}):`
  );
  for (const f of failures) {
    console.error(`  [${f.mode}] ${JSON.stringify(f.prompt)}`);
    console.error(`    expected=${f.expected} actual=${f.actual}`);
  }
  process.exit(1);
}

console.log(
  `OK: policy oracle heuristics match FULL_BASELINE_CONTRACT (${contract.cases.length} cases)`
);
