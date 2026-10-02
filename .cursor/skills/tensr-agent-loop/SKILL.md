---
name: tensr-agent-loop
description: Tensr assistant loop, Ask/Plan/Agent policy, clarification, plan batching, and provenance. Use when changing routing, tool args, or the approval card.
---

# Tensr agent loop

Use this when editing how a chat turn becomes a tool call, a clarification, or a refusal.

## Files

- `tensr-api/app/assistant/agent_loop.py` — turn entry. Calls `assess_turn_clarity`, then either `ask_clarifying_question` or the tool loop. Plan mode stores `rationale` and `plan_summary` from `materialize_run_analysis_args` (around the approval dict). Comment there: Plan is the executable request; Why is `why_this_test`; do not copy Why into Plan.
- `tensr-api/app/assistant/agent_clarity.py` — `assess_turn_clarity`. `force_clarify` reasons are only `empty_message`, `greeting_no_task`, `underspecified_run`, `underspecified_significance`, `underspecified_groups`, `column_clarification_reply`, `low_clarity`. `_COLUMN_DEFINITION` (`what does <name> mean`) returns `direct_text` before any tool call. `_EXPLORATORY_ASK` must stay out of `force_clarify`.
- `tensr-api/app/assistant/agent_tools.py` — seven tools in the module docstring. `import_file` attaches an uploaded file as a dataset and does not run user code. `materialize_run_analysis_args` returns `(materialized_args, plan_text, error)`. Plan text comes from the validated body, not freeform `why_this_test`. `user_message` must be the real user ask. `_unsupported_analysis_type_message` refuses unknown types. `stamp_result_provenance` stamps outputs.
- `tensr-api/app/assistant/control_language.py` — "independent of X" excludes X. "controlling for X" keeps X as a covariate, except a shot-volume factor (`_SHOOTING_FACTOR_RE`), which is still excluded.
- `tensr-platform-web/src/lib/agent-loop-contract.ts` — `FULL_BASELINE_CONTRACT`.
- `tensr-platform-web/src/lib/run-agent-data-action.ts` — `shouldRouteMessageToDataIntent`. Historical keyword gate, not the live loop, but still what the baseline eval asserts.
- `tensr-platform-web/src/lib/chat-pending-action.ts` — `formatPlanVariablesLine` builds the card line from `plan.spec`. It must match the tool args.
- `tensr-platform-web/src/lib/agent-analysis-chat-fields.ts` — `chatFieldsAfterRunAnalysis`. Chat renders `content` and `resultMarkdown`. If they are equal, the report shows twice.

## Add a tool behaviour or fix routing

1. Read the branch in `agent_loop.py` and the matching case in `FULL_BASELINE_CONTRACT`.
2. If the change is a keyword or a hard `force_clarify` branch, add the case to the contract first. "What does X mean" stays `direct_text`.
3. Keep the tool name inside the seven in the module docstring. Thread plan text from `materialize_run_analysis_args` onto `args["rationale"]` and `plan_summary`. Do not invent a parallel sentence in the web card.
4. Stamp results with `stamp_result_provenance`.
5. Run `tensr-api`: `.venv/bin/python -m pytest -q --tb=short tests/test_agent_loop_categories.py tests/test_agent_loop_tools.py tests/test_agent_fidelity.py`.
6. Run `tensr-platform-web`: `pnpm run check:agent-eval-promptfoo` and `pnpm run test:agent-loop`.

## Pitfalls

- `\bmean\b` is in the aggregate arm of `shouldRouteMessageToDataIntent` (line with `sum|total|average|mean`). "What does Age mean?" is `direct_text` in the live clarity check and a documented false positive in the contract (`description` on that case). A new gate that runs before `_COLUMN_DEFINITION` will short-circuit it.
- `\bwhere\b` is in the filter arm of the same function. "Where do I start?" is `tool_or_clarify` in the contract, and the baseline gate label is `data-intent` because the keyword wins over exploratory. Do not copy that into `assess_turn_clarity`.
- Exploratory phrasing (`predict`, `what explains`, `associated with`) is `_EXPLORATORY_ASK`. It must reach the tool loop, not `force_clarify` / `low_clarity`. Covered by `test_exploratory_ask_nudges_tools_instead_of_force_clarify`.
- Plan/args drift: `formatPlanVariablesLine` pretty-prints `plan.spec` (four keys, special cases for regression, ANOVA, correlations). If that spec is not the materialized tool args, the card lies. The NBA card in `tensr-platform-web/tests/plan-approve-nba.spec.ts` expects the rationale "Regress points on age and minutes, leaving shot volume out."
- Generic `why_this_test`: Why is the method rationale stored on the args. A sentence that does not name the outcome, the predictors, and the control phrase will not match `why_control_contradicts_independents`. Do not paste Why into Plan (`agent_loop.py` drops that duplication).
- Report twice: `chatFieldsAfterRunAnalysis` keeps the plan in `content` and the report only in `resultMarkdown`. `agent-analysis-chat-fields.test.ts` ("does not set identical content and resultMarkdown") locks this.
