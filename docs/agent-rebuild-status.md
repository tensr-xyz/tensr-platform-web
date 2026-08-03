# Tensr Agent Rebuild — Status Report

Living document. Updated as the build progresses.

**Primary surfaces:** `tensr-platform-web` (agent panel) + `tensr-api` (assistant)
**Started:** 2026-08-03

See also root copy if present at `../docs/agent-rebuild-status.md` (workspace is multi-repo).

---

## §0 Verification — confirm / correct

| Claim                                    | Verdict                           | Notes                                                                |
| ---------------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| Routing in agent-panel cascade           | **CONFIRM** (`handleSendMessage`) | menu → prep → data-intent → exploratory → analysis → quality → tutor |
| Menu dispatch steals unless inline chart | **CONFIRM**                       |                                                                      |
| Gates 1–5 + tutor fallback               | **CONFIRM**                       | Gate 4 catch does not `return` (bug)                                 |
| Dead `confidence` on parse-intent        | **CONFIRM**                       | prompt-only; not on response model                                   |
| Tier-1 fidelity gate shipped             | **CONFIRM**                       | residual: omitted agg → sum when fidelity pattern misses             |
| Ask/Plan/Agent UI                        | **ABSENT**                        | building                                                             |
| Usability transcripts / Linear           | **ABSENT**                        | corpus from fidelity tests + probed cases                            |

### Baseline expected values = actual cascade (option 1)

Committed in `agent-eval/results/routing-baseline.json` (jest 22/22).

Notable actual vs original-spec guesses: Age-mean→data-intent; t-test/correlation→menu-analysis; Where do I start→data-intent; data quality scan→menu-dialog; quartile/top5%→tutor; boxplot→menu-dialog.

---

## Build progress

| Phase                        | Status                             |
| ---------------------------- | ---------------------------------- |
| §4.1 baseline (full cascade) | **Done**                           |
| Agent loop + tools           | In progress                        |
| Fidelity residual            | Pending                            |
| Items 5 / 6 / 9              | Pending (SSE-S3; KMS out of scope) |
| §4.2 + CI                    | Pending                            |
| Client rewire + modes        | Pending                            |

---

## Decisions log

| When       | Decision                                  |
| ---------- | ----------------------------------------- |
| 2026-08-03 | Option 1 baseline includes menu-\*.       |
| 2026-08-03 | Item 9 = SSE-S3; KMS future-only note.    |
| 2026-08-03 | Baseline committed; proceeding into loop. |
