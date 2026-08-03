# Tensr Agent Rebuild — Status Report

**Primary surfaces:** `tensr-platform-web` + `tensr-api`  
**Updated:** 2026-08-03 (final pre-push)

---

## Gap closure

| #   | Item                                  | Status                                                                |
| --- | ------------------------------------- | --------------------------------------------------------------------- |
| 1   | Delete `/assistant/followup` for real | **DONE** — `followup.py` + client helpers removed                     |
| 2   | Live category-1/2 tests               | **DONE** — `tests/test_agent_loop_categories.py`                      |
| 3   | Item 8 hard ambiguity branch          | **DONE** — `agent_clarity.py`                                         |
| 4   | Item 4 mode-aware `data_edit`         | **DONE** — Agent auto-persist / Plan propose-then-approve             |
| 5   | Item 1/2 Plan rationale hard-gate     | **DONE**                                                              |
| 6   | Item 3 prior-result chaining          | **DONE**                                                              |
| 7   | Full baseline comparison              | **DONE** — `agent-loop-contract.ts` + Promptfoo post suite            |
| 8   | Row-level provenance                  | **DONE** — `source_row_indices` + content fingerprint (write-forward) |
| 9   | ReportChart axis formatting           | **DONE** — ticks, size-aware labels, datetime, density                |

### Fixed tool set (auditable)

`read_data`, `run_analysis`, `data_edit`, `ask_clarifying_question`, `start_prep_playbook`, `run_data_quality_scan`

### `resolveChatAction` — what is actually true

**Removed from the chat steal-path.** `handleSendMessage` only calls `runAgentLoop`.

**Still live for:**

1. **Baseline eval** — `resolve-agent-gate.ts` / `agent-eval/run-gate.ts` reconstruct the old cascade (including `resolveChatAction` menu-\* outcomes) for before/after comparison.
2. **Approval / manual analysis run path** — `run-agent-analysis-plan.ts` may fall back to `resolveChatAction` when executing an approved analysis plan.

The Analysis ⌘K command palette does **not** import `resolveChatAction`; it uses its own setup UI. Menu-style phrases typed in chat (t-test, boxplot, data quality) are handled by agent-loop tools, not by opening a palette dialog.

### Encryption (Item 9)

SSE-S3 (`S3_MANAGED`); KMS future-only — see `docs/DATA_TRUST_AND_COMPLIANCE.md`.

### Provenance (Item 5)

Pointers on `run_analysis` / chart / aggregate outputs include `dataset_id`, columns, **0-based `source_row_indices`**, and a `content_fingerprint` over those cells. Write-forward only (no backfill). Survives identical re-upload via fingerprint. See `tensr-api/app/assistant/provenance.py`.

### Axis formatting (Item 6 follow-up)

`ReportChart` density `inline` | `comfortable`; numeric ticks; size-aware category truncation/rotation; datetime axis formatting. Fullscreen + PNG export use comfortable density. Details: `docs/chart-axis-formatting-status.md`.

---

## Regression harness (authoritative)

| Layer                   | Command                                                   | Role                                      |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------- |
| Jest baseline cascade   | `pnpm test:agent-baseline` / `resolve-agent-gate.test.ts` | Pre-rewrite gate oracle                   |
| Jest post + mode policy | `pnpm test:agent-post` → `agent-loop-contract.test.ts`    | Post-rewrite + Ask/Plan/Agent labels      |
| Jest loop client        | part of `pnpm test:agent-loop`                            | Client mapping helpers                    |
| Promptfoo baseline      | `pnpm test:agent-baseline:promptfoo`                      | Same baseline via Promptfoo file provider |
| Promptfoo post          | `pnpm test:agent-post:promptfoo`                          | Post + mode policy via Promptfoo          |
| Live category-1/2       | `tensr-api` `test_agent_loop_categories.py`               | Hits real `/assistant/agent-loop`         |

**Corpus source of truth:** `FULL_BASELINE_CONTRACT` in `src/lib/agent-loop-contract.ts`. Both Promptfoo YAMLs (+ `agent-eval/baseline-contract.generated.json`) are generated — do not edit by hand.

```bash
pnpm run generate:agent-eval-promptfoo   # rewrite YAML/JSON from the contract
pnpm run check:agent-eval-promptfoo      # CI drift gate (+ heuristic oracle sync)
```

CI (`.github/workflows/agent-eval.yml`) runs the sync check, Jest agent-loop + `test:agent-post`, **and** both Promptfoo scripts. Providers export constructor classes required by Promptfoo `file://` loading.
