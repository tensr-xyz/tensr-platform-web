# Tensr platform web

This file mirrors `.cursor/rules/tensr-agent-contract.mdc`. Follow it in Claude Code the same way.

Clarification goes through `ask_clarifying_question` only (`tensr-api/app/assistant/agent_tools.py`). `force_clarify` reasons stay the closed set in `assess_turn_clarity` (`tensr-api/app/assistant/agent_clarity.py`): `empty_message`, `greeting_no_task`, `underspecified_run`, `underspecified_significance`, `underspecified_groups`, `column_clarification_reply`, `low_clarity`.

The tool set stays those six names. No code execution.

A new keyword or deterministic gate ships with a `FULL_BASELINE_CONTRACT` case in `src/lib/agent-loop-contract.ts` and `pnpm run check:agent-eval-promptfoo`. "What does X mean" stays `direct_text`. `\bmean\b` and `\bwhere\b` in `src/lib/run-agent-data-action.ts` (`shouldRouteMessageToDataIntent`) are known false positives.

Plan text comes from the tool-call args. `materialize_run_analysis_args` in the API derives it; `formatPlanVariablesLine` in `src/lib/chat-pending-action.ts` must show those args, not a second sentence. `chatFieldsAfterRunAnalysis` in `src/lib/agent-analysis-chat-fields.ts` keeps the plan in `content` and the report only in `resultMarkdown`.

Unsupported analysis types refuse. `regression` aliases `linear_regression` and is not a datasets route.

Results go through `stamp_result_provenance` in the API.

Do not say the work is done until the matching test command has been run and its output is shown. See `.cursor/commands/tensr-prepush.md`.

Skills, on demand, live in `.cursor/skills/`: `tensr-agent-loop`, `tensr-add-analysis`, `tensr-evals`, `tensr-stats-judgment`, `tensr-market-research`, `tensr-aws-debug`, `tensr-e2e`.

Agents in `.cursor/agents/`: `tensr-agent-reviewer`, `tensr-stats-reviewer`, `tensr-verifier`. Use `security-reviewer` for Stytch, CDK, IAM, or env changes.
