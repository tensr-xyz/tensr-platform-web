---
description: Run tensr-agent-reviewer and tensr-stats-reviewer on the current diff.
---

# /tensr-review

1. Collect `git diff` and `git diff --cached` in `tensr-api` and `tensr-platform-web`.
2. Follow `.cursor/agents/tensr-agent-reviewer.md` on any hunk in `app/assistant/`, `src/lib/agent-loop-contract.ts`, `src/lib/agent-analysis-chat-fields.ts`, `src/lib/chat-pending-action.ts`, or `src/lib/run-agent-data-action.ts`.
3. Follow `.cursor/agents/tensr-stats-reviewer.md` on any hunk in stats, tables, weights, `control_language.py`, `linear_dependence.py`, `report_builder.py`, or plan-card tests.
4. Write findings as `file:line`. If a repo has no relevant hunks, say which diff you read.
5. Do not claim the suite is green unless `.cursor/commands/tensr-prepush.md` was run in this turn.
