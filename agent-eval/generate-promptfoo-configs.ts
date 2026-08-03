/**
 * Generate Promptfoo YAML (+ JSON mirror) from FULL_BASELINE_CONTRACT.
 *
 * Usage:
 *   pnpm exec tsx agent-eval/generate-promptfoo-configs.ts
 *   pnpm exec tsx agent-eval/generate-promptfoo-configs.ts --check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FULL_BASELINE_CONTRACT,
  baselineGateCases,
  type BaselineContractCase,
} from '../src/lib/agent-loop-contract';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;

const BASELINE_YAML = path.join(OUT_DIR, 'promptfooconfig.routing-baseline.yaml');
const POST_YAML = path.join(OUT_DIR, 'promptfooconfig.routing-post.yaml');
const JSON_MIRROR = path.join(OUT_DIR, 'baseline-contract.generated.json');

const HEADER = `# AUTO-GENERATED from src/lib/agent-loop-contract.ts (FULL_BASELINE_CONTRACT).
# DO NOT EDIT — run: pnpm run generate:agent-eval-promptfoo
# Drift check: pnpm run check:agent-eval-promptfoo
`;

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function renderBaselineYaml(cases: BaselineContractCase[]): string {
  const tests = cases
    .map(c => {
      const desc = c.description ? `\n    description: ${yamlString(c.description)}` : '';
      return `  - vars: { prompt: ${yamlString(c.prompt)} }
    assert: [{ type: equals, value: ${yamlString(c.baselineGate!)} }]${desc}`;
    })
    .join('\n\n');

  return `${HEADER}
description: Tensr agent routing baseline (before tool-calling loop rewrite)

providers:
  - file://promptfoo-provider-routing-baseline.cjs

tests:
${tests}
`;
}

function renderPostYaml(cases: BaselineContractCase[]): string {
  const tests = cases
    .map(c => {
      return `  - vars: { prompt: ${yamlString(c.prompt)}, mode: ${c.mode} }
    assert: [{ type: equals, value: ${yamlString(c.expected)} }]`;
    })
    .join('\n');

  return `${HEADER}
# Live category-1/2 proof: tensr-api/tests/test_agent_loop_categories.py
description: Tensr agent loop post-rewrite full baseline contract

providers:
  - file://promptfoo-provider-agent-loop-policy.cjs

tests:
${tests}
`;
}

function renderJsonMirror(cases: BaselineContractCase[]): string {
  const payload = cases.map(c => ({
    prompt: c.prompt,
    mode: c.mode,
    expected: c.expected,
    ...(c.baselineGate ? { baselineGate: c.baselineGate } : {}),
    ...(c.description ? { description: c.description } : {}),
  }));
  return (
    JSON.stringify(
      {
        _generated_from: 'src/lib/agent-loop-contract.ts#FULL_BASELINE_CONTRACT',
        cases: payload,
      },
      null,
      2
    ) + '\n'
  );
}

function writeOrCheck(filePath: string, contents: string, check: boolean): boolean {
  if (check) {
    if (!fs.existsSync(filePath)) {
      console.error(`Missing generated file: ${filePath}`);
      return false;
    }
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing !== contents) {
      console.error(`Drift detected: ${path.relative(process.cwd(), filePath)}`);
      console.error('Run: pnpm run generate:agent-eval-promptfoo');
      return false;
    }
    return true;
  }
  fs.writeFileSync(filePath, contents, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), filePath)}`);
  return true;
}

function main(): number {
  const check = process.argv.includes('--check');
  const baselineCases = baselineGateCases();
  const allCases = FULL_BASELINE_CONTRACT;

  const ok = [
    writeOrCheck(BASELINE_YAML, renderBaselineYaml(baselineCases), check),
    writeOrCheck(POST_YAML, renderPostYaml(allCases), check),
    writeOrCheck(JSON_MIRROR, renderJsonMirror(allCases), check),
  ].every(Boolean);

  if (check) {
    if (!ok) return 1;
    console.log(
      `OK: Promptfoo corpora match FULL_BASELINE_CONTRACT ` +
        `(baseline=${baselineCases.length}, post=${allCases.length})`
    );
  }
  return ok ? 0 : 1;
}

process.exit(main());
