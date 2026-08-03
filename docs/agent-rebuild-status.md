# Tensr Agent Rebuild — Status Report

Living document for the tool-calling agent rebuild.

**Repos:** `tensr-platform-web` + `tensr-api`  
**Started:** 2026-08-03

---

## §0 Verification (confirm / correct)

| Claim                                 | Verdict                                                             |
| ------------------------------------- | ------------------------------------------------------------------- |
| Client cascade in `handleSendMessage` | **CONFIRM**                                                         |
| Menu dispatch steals before gates     | **CONFIRM**                                                         |
| Gates 1–5 + tutor fallback            | **CONFIRM**                                                         |
| Gate 4 exception fall-through bug     | **CONFIRM** — eliminated by cascade removal                         |
| Dead `confidence` on parse-intent     | **CONFIRM**                                                         |
| Tier-1 fidelity already shipped       | **CONFIRM** — residual omitted-agg→sum fixed in `run_analysis` tool |
| Ask/Plan/Agent UI                     | Was absent — **built**                                              |
| Usability transcripts                 | Absent — corpus from fidelity tests + probed cases                  |

Baseline expected values use **actual** cascade including `menu-analysis` / `menu-dialog` (option 1).

---

## What changed

### Backend (`tensr-api`)

- `app/assistant/agent_tools.py` — fixed tool set + executors (no code execution)
- `app/assistant/agent_loop.py` — Ask / Plan / Agent loop policies, step cap 4, tool logging, partial-failure handling
- `app/assistant/llm.py` — `chat_completion_message` with `tools` / `tool_calls`
- `POST /assistant/agent-loop` route
- Fidelity: `run_analysis` refuses unknown aggs, omitted agg on percentile ask, and sum-for-percentile plans
- Provenance pointers on `read_data` / `run_analysis` outputs (dataset_id + columns + fingerprint; source file not transformed)
- CI: blocking job for `test_agent_loop_tools.py` + `test_agent_fidelity.py`

### Frontend (`tensr-platform-web`)

- Chat sends go through single `runAgentLoop` — cascade removed
- Ask/Plan/Agent mode selector + persisted store
- Approval UI for Plan / low-confidence writes
- Multi-tab `open_datasets` for Item 7
- Item 6: fullscreen chart view + 3× PNG export on report + inline charts
- Item 9: `docs/DATA_TRUST_AND_COMPLIANCE.md` (SSE-S3 accurate; KMS future-only)

### Eval

- §4.1 baseline: `agent-eval/results/routing-baseline.json` (committed earlier, jest 22/22)
- §4.2 post: `agent-eval/results/routing-post.json` + `agent-loop-policy` jest suite
- CI workflow `.github/workflows/agent-eval.yml`

---

## Promptfoo / suite results

### Baseline (§4.1) — before rewrite

Source: `agent-eval/results/routing-baseline.json` — **20/20** documented cases; jest suite **22/22**.

| Prompt                                 | Gate          |
| -------------------------------------- | ------------- |
| Hello                                  | tutor         |
| What does Age mean?                    | data-intent   |
| How do I interpret a p-value?          | tutor         |
| run one for me                         | tutor         |
| why is that significant?               | tutor         |
| Can you help me understand the groups? | tutor         |
| t test for me on my dataset            | menu-analysis |
| How many members joined after 2024?    | data-intent   |
| Sum of Revenue by Region               | data-intent   |
| Make a monthly line chart              | data-intent   |
| What's interesting?                    | exploratory   |
| Where do I start?                      | data-intent   |
| Clean this dataset                     | prep-playbook |
| Run a data quality scan                | menu-dialog   |
| correlation between Age and PTS        | menu-analysis |
| … + fidelity/screenshot routing cases  | see JSON      |

### Post-rewrite (§4.2) — policy oracle per mode

Source: `agent-eval/results/routing-post.json` + `src/lib/agent-loop-policy.test.ts`.

| Mode  | Example                           | Expected policy          |
| ----- | --------------------------------- | ------------------------ |
| agent | t test / correlation / percentile | `run_analysis`           |
| agent | Clean this dataset                | `start_prep_playbook`    |
| agent | Run a data quality scan           | `run_data_quality_scan`  |
| agent | run one for me                    | `clarify`                |
| agent | Hello / p-value / significance    | `text-or-clarify`        |
| ask   | t test / Clean…                   | `ask-no-write`           |
| plan  | t test                            | `plan-awaiting-approval` |
| agent | geometric mean                    | `refuse-or-clarify`      |

---

## Fidelity fix — verified independently of routing

Pytest (`tensr-api`): **28 passed** including:

| Test                                                          | Proves                                        |
| ------------------------------------------------------------- | --------------------------------------------- |
| `test_run_analysis_refuses_unknown_agg_instead_of_sum`        | Unknown agg → refuse, not sum                 |
| `test_run_analysis_refuses_omitted_agg_when_percentile_asked` | Percentile ask + omitted agg → refuse         |
| `test_run_analysis_blocks_sum_plan_for_percentile_ask`        | Explicit sum plan for percentile ask → refuse |
| `test_run_analysis_percentile_ok`                             | Faithful percentile executes                  |
| Existing `test_agent_fidelity.py` Tier-1 suite                | Gate + executor honesty still green           |

These call `tool_run_analysis` directly — **not** the old client gate cascade.

---

## `resolveChatAction` menu-dispatch — how handled

**Kept as a UI fast-path for ⌘K / palette-style menu resolution; removed as a chat steal-path.**

Chat `handleSendMessage` no longer calls `resolveChatAction`. Phrases that previously became `menu-analysis` / `menu-dialog` (t-test, correlation, data quality, boxplot) are handled by the loop’s tool-call reasoning (`run_analysis`, `run_data_quality_scan`, etc.). This is required so the before/after comparison is not blind to that code path, and so Agent mode does not open a setup dialog when the user asked the agent to run something.

---

## Fixed tool set (auditable — no code execution)

```
read_data
run_analysis
data_edit
ask_clarifying_question
start_prep_playbook
run_data_quality_scan
```

Confirmed in `AGENT_TOOL_NAMES` and `test_fixed_tool_set_has_no_code_execution`.

---

## Open risks

1. Live LLM eval of `/assistant/agent-loop` still needs credentials in CI for end-to-end Promptfoo against the real endpoint (offline policy oracle covers mode contracts today).
2. `data_edit` returns `proposed_action` for recode/bin/fix_types (derived dataset save) — Agent mode describes + confirms via existing apply path; full auto-persist of derived datasets may need a follow-up if product wants zero-click writes.
3. Platform-web `node_modules` was fragile during this session (workspace hoist); local jest may need a clean `pnpm install` on a fresh machine.

---

## Decisions log

| When       | Decision                                      |
| ---------- | --------------------------------------------- |
| 2026-08-03 | Option 1 baseline includes menu-\*            |
| 2026-08-03 | Item 9 = SSE-S3; KMS future-only              |
| 2026-08-03 | Menu dispatch folded out of chat; kept for ⌘K |
| 2026-08-03 | Baseline commit `96ebcc2`; rebuild continued  |
