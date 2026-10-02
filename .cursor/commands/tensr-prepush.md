---
description: Run the Tensr CI commands for repos in the diff. Promptfoo evals only when agent files or the contract changed. Then security-reviewer if auth or infra changed.
---

# /tensr-prepush

From the repo roots, inspect `git diff --name-only` against the branch you are pushing (or `HEAD` if the diff is unstaged, using `git diff --name-only` and `git diff --cached --name-only`).

## tensr-api, when any API file changed

These are the steps in `.github/workflows/ci.yml`:

```bash
cd tensr-api
.venv/bin/python scripts/generate_agent_capabilities_ts.py --check
.venv/bin/python -m pytest -q --tb=short tests/test_r_syntax_fidelity.py
.venv/bin/python -m pytest -q --tb=short \
  tests/test_agent_loop_tools.py \
  tests/test_agent_loop_categories.py \
  tests/test_agent_fidelity.py \
  tests/test_analysis_type_allowlist_parity.py \
  tests/test_datasets_analyze_dispatch.py
.venv/bin/python -m pytest -q --tb=short -m "not nsjail"
python scripts/check_lambda_bundle_imports.py --install-requirements
```

The R syntax job needs `Rscript` and survey 4.5, as that workflow installs. If R is missing, say so and still run the pytest jobs that do not need it. Show each exit code.

## tensr-platform-web, when any web file changed

`.github/workflows/menu-catalog.yml` runs `pnpm run test:jest`.

`.github/workflows/e2e.yml` runs `pnpm run test` (Playwright `playwright.config.ts` plus `playwright.auth.config.ts`).

## Promptfoo

Run these only when the diff touches `tensr-api/app/assistant/` or `tensr-platform-web/src/lib/agent-loop-contract.ts` (or `agent-eval/`):

```bash
cd tensr-platform-web
pnpm run check:agent-eval-promptfoo
pnpm run test:agent-loop
pnpm run test:agent-post
pnpm run test:agent-baseline:promptfoo
pnpm run test:agent-post:promptfoo
```

That is `.github/workflows/agent-eval.yml`. Do not run the Promptfoo evals for an unrelated UI diff.

## security-reviewer

If the diff touches Stytch (`infra/stacks/secrets_config.py`, auth handlers), `infra/`, IAM, or env files, hand the diff to the `security-reviewer` agent. Do not run `/security-scan`.

`live-e2e.yml` is `workflow_dispatch`. It is not part of this pre-push unless you are about to dispatch it.

Paste the command output. A command you did not run is not green.
