---
description: Reproduce a Tensr bug in the suite that owns it, then fix, then rerun that command.
---

# /tensr-bug

1. Name the bug in one sentence and the file that owns the behaviour.
2. Reproduce it before changing the fix.
   - Assistant routing or `force_clarify`: a failing case in `tensr-platform-web/src/lib/agent-loop-contract.ts` and/or `tensr-api/tests/test_agent_loop_categories.py`. "What does X mean" stays `direct_text`.
   - Allowlist / wrong op name: `tensr-api/tests/test_analysis_type_allowlist_parity.py`.
   - Plan card or report double-render: `tensr-platform-web/tests/plan-approve-nba.spec.ts` or `src/lib/agent-analysis-chat-fields.test.ts`.
   - Nets, weights, banners: the pytest module that imports that function.
   - UI: a Playwright spec under `tensr-platform-web/tests/`.
3. Run that command and show the failure.
4. Fix.
5. Rerun the same command and show the pass. Follow `.cursor/skills/tensr-agent-loop/SKILL.md` or `.cursor/skills/tensr-add-analysis/SKILL.md` when the bug is in those paths.

Do not start from a green tree and call it a reproduction.
