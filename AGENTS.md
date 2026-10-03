# Tensr platform web — agent instructions

Several agents work on this repo at the same time. `CLAUDE.md` and `.cursor/rules/tensr-agents-md.mdc` point here.

## Git workflow

The base branch is `development` (the Vercel preview branch). `main` is production and is released manually; do not open PRs against it unless asked.

1. Start every task in a new worktree. Never work in the main checkout.

   ```bash
   git fetch origin
   git worktree add ../tensr-platform-web-<task> -b agent/<task> origin/development
   cd ../tensr-platform-web-<task>
   pnpm install --frozen-lockfile
   ```

2. Keep PRs small, one task each.
3. Before opening the PR, rebase on the latest base and run the tests relevant to your change (commands in `.cursor/commands/tensr-prepush.md`). Paste their output in the PR or your reply. CI is the final gate: `typecheck` (tsc), `menu-catalog` (Jest), and `e2e` (mocked Playwright) are required on `development`, and the PR must be up to date with it.

   ```bash
   git fetch origin && git rebase origin/development
   ```

4. Never push to `development` or `main`. Push your branch, open a PR, and queue the merge.

   ```bash
   git push -u origin agent/<task>
   gh pr create --base development --fill
   gh pr merge --auto --squash
   ```

5. If CI fails, or the PR falls behind `development`, fix it on the same branch: rebase, then `git push --force-with-lease` to your own branch. Never force-push `main` or `development`, and never skip hooks (`--no-verify`). The pre-commit hook runs prettier and `next build`.
6. After the PR merges, clean up:

   ```bash
   cd ../tensr-platform-web
   git worktree remove ../tensr-platform-web-<task>
   git branch -D agent/<task>
   ```

### Shared machine

- Never run `git stash pop` or `git stash apply` on a stash you did not create.
- Never touch another worktree, another agent's branch, or someone else's dev server. Check a port with `lsof -nP -iTCP:<port> -sTCP:LISTEN` and use a free one (`pnpm dev -- --port <port>`).
- `playwright.config.ts` serves on 3000 and `playwright.auth.config.ts` on 3001, and both reuse a server that is already listening. If another agent holds the port, do not stop it and do not test against it; leave Playwright to CI or point a throwaway config at a free port.
- Never dispatch `deploy-prod` in `tensr-api`.

## Assistant contract

Clarification goes through `ask_clarifying_question` only (`tensr-api/app/assistant/agent_tools.py`). `force_clarify` reasons stay the closed set in `assess_turn_clarity` (`tensr-api/app/assistant/agent_clarity.py`): `empty_message`, `greeting_no_task`, `underspecified_run`, `underspecified_significance`, `underspecified_groups`, `column_clarification_reply`, `low_clarity`.

The tool set stays the seven names in the `agent_tools.py` module docstring: `read_data`, `run_analysis`, `data_edit`, `import_file`, `ask_clarifying_question`, `start_prep_playbook`, `run_data_quality_scan`. No code execution.

A new keyword or deterministic gate ships with a `FULL_BASELINE_CONTRACT` case in `src/lib/agent-loop-contract.ts` and `pnpm run check:agent-eval-promptfoo`. "What does X mean" stays `direct_text`. `\bmean\b` and `\bwhere\b` in `src/lib/run-agent-data-action.ts` (`shouldRouteMessageToDataIntent`) are known false positives.

Plan text comes from the tool-call args. `materialize_run_analysis_args` in the API derives it; `formatPlanVariablesLine` in `src/lib/chat-pending-action.ts` must show those args, not a second sentence. `chatFieldsAfterRunAnalysis` in `src/lib/agent-analysis-chat-fields.ts` keeps the plan in `content` and the report only in `resultMarkdown`.

Unsupported analysis types refuse. `regression` aliases `linear_regression` and is not a datasets route.

Results go through `stamp_result_provenance` in the API.

Do not say the work is done until the matching test command has been run and its output is shown. See `.cursor/commands/tensr-prepush.md`.

Skills, on demand, live in `.cursor/skills/`: `tensr-agent-loop`, `tensr-add-analysis`, `tensr-evals`, `tensr-stats-judgment`, `tensr-market-research`, `tensr-aws-debug`, `tensr-e2e`.

Agents in `.cursor/agents/`: `tensr-agent-reviewer`, `tensr-stats-reviewer`, `tensr-verifier`. Use `security-reviewer` for Stytch, CDK, IAM, or env changes.
