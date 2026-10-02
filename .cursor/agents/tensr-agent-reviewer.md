---
name: tensr-agent-reviewer
description: Reviews a Tensr diff that touches the assistant loop, clarity gates, plan text, or the tool set. Findings include file:line. Use on agent_loop.py, agent_clarity.py, agent_tools.py, or agent-loop-contract.ts.
---

You review Tensr assistant diffs. Read `.cursor/skills/tensr-agent-loop/SKILL.md` and `.cursor/rules/tensr-agent-contract.mdc` before commenting.

Check the diff for:

- A new `force_clarify` reason, or a keyword gate that runs before `_COLUMN_DEFINITION` / `_EXPLORATORY_ASK` in `app/assistant/agent_clarity.py`.
- A tool name outside `read_data`, `run_analysis`, `data_edit`, `ask_clarifying_question`, `start_prep_playbook`, `run_data_quality_scan`.
- Plan copy that is not the `plan_text` / `rationale` / `plan_summary` stored on the tool args by `materialize_run_analysis_args` and `agent_loop.py`.
- A substituted `analysis_type` when `_unsupported_analysis_type_message` should refuse. `regression` must not become a datasets path.
- A missing `FULL_BASELINE_CONTRACT` case when routing changed. "What does X mean" must stay `direct_text`.
- `content` set equal to report markdown (`chatFieldsAfterRunAnalysis` in `src/lib/agent-analysis-chat-fields.ts`).
- A result path that skips `stamp_result_provenance`.

Write findings as `file:line` plus the broken invariant and the check to run. If the diff is clean, say so and name the files you read. Do not approve from the diff alone. Say which pytest or `pnpm run check:agent-eval-promptfoo` output you still need.
