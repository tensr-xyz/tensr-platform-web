# Chat progress clear after answer

Source plan: none. Journey written for a merge regression.

## User journey

As an analyst, I want Working / schema / summary progress to disappear once the chat answer is on screen, including chat-only subgroup rates that have no `resultMarkdown`.

## Task report

- Merge of `development` into `main` restamped live `progressLines` onto the finished assistant message. Chat-only answers never took the `run_analysis` path that cleared them.
- RED: `pnpm exec jest --forceExit --watchman=false src/components/organisms/agent-panel/agent-chat-chrome.test.tsx` — new case failed because `visibleThinkingLines` kept lines when `hasResult: false` and `isStreaming: false`.
- GREEN: same command plus `src/lib/agent-loop-client.test.ts` — 14 passed. `updateMessage(..., patch)` again keeps `thinkingLines: undefined` from `deriveMessageUpdateFromLoopResponse`.
- Follow-up: merge also stacked raw SSE `progress.message` on interpreted lines. RED/GREEN via `accumulateInterpretedLoopProgress` in `agent-analysis-progress.test.ts`.
- Follow-up: report view showed the amber Traceability banner and ProvenanceInspector for the same object. Banner now only for plugin-unverified or missing provenance. RED/GREEN in `analysis-report-view/index.test.tsx`.
- Follow-up: merge brought main commit `7007a38` which seeded `pushAgentProgress({ step: 'start', message: '' })` → static `Working…` next to development's pulsing `Working`. That start seed is removed; empty progress interpolates to `''`; pulse-only lines are filtered. RED/GREEN in `agent-analysis-progress.test.ts` and `agent-chat-chrome.test.tsx`.
- Follow-up (P1): report leads with `Verified against R ✓`, `N of M source rows used`, and the R/SPSS equivalent syntax. Convention jargon (`variance_mode`) is not shown. RED/GREEN in `analysis-report-view/index.test.tsx`.

## Test specification

| #   | What is guaranteed                                   | Test                                                                                                          | Type | Result | Evidence               |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---- | ------ | ---------------------- |
| 1   | Progress stays visible while the loop is streaming   | `agent-chat-chrome.test.tsx` hides Working/schema progress after a chat-only answer finishes (streaming case) | unit | PASS   | jest agent-chat-chrome |
| 2   | Progress is hidden after a chat-only answer finishes | same test, `isStreaming: false`                                                                               | unit | PASS   | jest agent-chat-chrome |
| 3   | Completed loop patches clear `thinkingLines`         | `agent-loop-client.test.ts` clears thinkingLines on clarification, approval, and completed answers            | unit | PASS   | jest agent-loop-client |

## Coverage and gaps

No E2E for this chrome helper. Persist reload already strips `thinkingLines` in `reviveProjects`.
