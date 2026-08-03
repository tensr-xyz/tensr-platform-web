# Tensr Agent Rebuild — Status Report

**Primary surfaces:** `tensr-platform-web` + `tensr-api`

---

## Gap closure (post sign-off review)

| #   | Item                                  | Status                                                                                                                                               |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Delete `/assistant/followup` for real | **DONE** — `followup.py` deleted; routes removed; client helpers removed; post-grep empty on `tensr-api/app` + `tensr-platform-web/src`              |
| 2   | Live category-1/2 tests               | **DONE** — `tests/test_agent_loop_categories.py` hits `POST /assistant/agent-loop`; asserts empty `tool_trace` vs `ask_clarifying_question` in trace |
| 3   | Item 8 hard ambiguity branch          | **DONE** — `agent_clarity.py` + forced `ask_clarifying_question` before model tools                                                                  |
| 4   | Item 4 mode-aware `data_edit`         | **DONE** — Agent high-confidence / approved → `auto_persist=True`; Plan → propose then persist on approve                                            |
| 5   | Item 1/2 Plan rationale hard-gate     | **DONE** — missing `why_this_test` blocks + retries generation                                                                                       |
| 6   | Item 3 prior-result chaining          | **DONE** — merges filters, columns, prior stats/results, derived dataset ids                                                                         |
| 7   | Full baseline comparison              | **DONE** — `routing-post.json` + `agent-loop-contract.ts` include menu-\* + category rules                                                           |

### Fixed tool set (auditable)

`read_data`, `run_analysis`, `data_edit`, `ask_clarifying_question`, `start_prep_playbook`, `run_data_quality_scan`

### Menu dispatch

Removed from chat path; kept for ⌘K. Menu phrases route via loop tools.

### Encryption (Item 9)

SSE-S3 (`S3_MANAGED`); KMS future-only — see `docs/DATA_TRUST_AND_COMPLIANCE.md`.
