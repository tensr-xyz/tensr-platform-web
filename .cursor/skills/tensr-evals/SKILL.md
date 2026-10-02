---
name: tensr-evals
description: Add a FULL_BASELINE_CONTRACT case, regenerate Promptfoo YAML, and run the baseline and post evals. Use when routing or mode policy changes.
---

# Tensr evals

Use this when a prompt should route differently, or when you add a gate.

## Files

- `tensr-platform-web/src/lib/agent-loop-contract.ts` — `FULL_BASELINE_CONTRACT`. Each case has `prompt`, `mode` (`ask` | `plan` | `agent`), and `expected`. Cases with `baselineGate` are in the routing-baseline corpus.
- `tensr-platform-web/agent-eval/generate-promptfoo-configs.ts` — writes `promptfooconfig.routing-baseline.yaml`, `promptfooconfig.routing-post.yaml`, and `baseline-contract.generated.json`. Header says do not edit those by hand.
- `tensr-platform-web/agent-eval/check-policy-oracle.cjs` — second half of `pnpm run check:agent-eval-promptfoo`.
- `tensr-platform-web/package.json` scripts: `generate:agent-eval-promptfoo`, `check:agent-eval-promptfoo`, `test:agent-loop`, `test:agent-post`, `test:agent-baseline:promptfoo`, `test:agent-post:promptfoo`.
- `tensr-platform-web/.github/workflows/agent-eval.yml` — runs that sequence when agent paths change.
- `tensr-api/tests/test_agent_loop_categories.py` — live `force_clarify` and exploratory behaviour. The contract file says live category proof lives here.
- `tensr-platform-web/tests/plan-approve-nba.spec.ts` — golden Plan card.

## Add a case

1. Append a `BaselineContractCase` in `FULL_BASELINE_CONTRACT`. Set `baselineGate` only if the historical `resolveGateInOrder` label (`tensr-platform-web/src/lib/resolve-agent-gate.ts`) should be pinned. Live chat does not use that cascade.
2. "What does X mean" stays `expected: 'direct_text'`. Copy the Age case rather than inventing a new outcome.
3. From `tensr-platform-web`: `pnpm run generate:agent-eval-promptfoo` then `pnpm run check:agent-eval-promptfoo`. The check is a byte match (`--check`) plus the policy oracle. A hand-edited YAML fails it.
4. `pnpm run test:agent-loop` and `pnpm run test:agent-post`.
5. Promptfoo evals (needs the provider, and they are what CI runs): `pnpm run test:agent-baseline:promptfoo` and `pnpm run test:agent-post:promptfoo`.
6. If the case is a live clarity branch, add the pytest in `test_agent_loop_categories.py` and run it.

## Golden cases to keep green

- "What does Age mean?" — `direct_text`. Baseline description: `\bmean\b` in the aggregate bucket.
- "Where do I start?" — `tool_or_clarify`. Baseline description: `\bwhere\b` in the filter bucket beats exploratory. Baseline gate label stays `data-intent`.
- NBA, `tests/plan-approve-nba.spec.ts`: prompt `what predicts points independent of shot volume`. Plan rationale is `Regress points on age and minutes, leaving shot volume out.` Why is `Points are continuous, so linear regression estimates the partial association.` API side: `tensr-api/tests/test_control_language_and_collinearity.py` ("Predict PTS controlling for shot volume") and `find_exact_linear_dependencies` in `tensr-api/app/linear_dependence.py` (`FG = 2P + 3P`, `TRB = ORB + DRB`).

## Pitfall

Editing the YAML without the contract, or editing the contract without generate, fails `check:agent-eval-promptfoo`. CI in `agent-eval.yml` runs the check before the Promptfoo evals.
