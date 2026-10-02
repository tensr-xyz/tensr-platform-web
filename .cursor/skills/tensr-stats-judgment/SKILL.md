---
name: tensr-stats-judgment
description: Statistical judgment for Tensr plans and reports. Control language, exact identities, VIF labelling, and plain-English rationale. Use when reviewing an analysis or a plan card.
---

# Tensr stats judgment

Use this when a plan, a report, or an agent `run_analysis` args object is supposed to be statistically right.

## What good looks like

- "Independent of X" / "excluding X" means X is not a predictor. `exclude_controlled_predictors` and `_EXCLUDE_PATTERNS` in `tensr-api/app/assistant/control_language.py`. The NBA prompt `what predicts points independent of shot volume` leaves FGA out (`tensr-platform-web/tests/plan-approve-nba.spec.ts`).
- "Controlling for X" / "holding X constant" means X stays as a covariate (`_COVARIATE_PATTERNS`), unless X is a shot-volume factor (`_SHOOTING_FACTOR_RE`: shot volume, FGA, FG, and the 2P/3P names). `test_control_language_and_collinearity.py` uses "Predict PTS controlling for shot volume".
- Exact identities are not covariates. `find_exact_linear_dependencies` in `tensr-api/app/linear_dependence.py` documents `FG = 2P + 3P` and `TRB = ORB + DRB`. The assistant Lambda uses this numpy helper because it does not ship scipy. Compute still runs on the datasets Lambda.
- VIF and condition number are labelled, not buried. `tensr-api/app/report_builder.py` builds a table with columns Variable, VIF, Tolerance. VIF above 10 (or infinite) gets the warning "multicollinearity may inflate coefficient variance." The condition number line is `Predictor design condition number is {value}`. Infinite VIF renders as `∞` (`stats_extensions.py` treats exact dependence as infinite VIF).
- The test matches the outcome. Continuous outcome with predictors is `linear_regression`, not the alias `regression`. Yes/no clustered outcomes use `gee` (see the hint in `constants.py`). Repeated measures in wide columns use `rm_anova`. Pupils-in-schools with enough groups use `mixed_model`; fewer than about 10 groups use `linear_regression` with `cluster_by` (same hint).
- Why is plain English and specific. The NBA Why is "Points are continuous, so linear regression estimates the partial association." A Why that only says "this test is appropriate" does not satisfy `why_control_contradicts_independents`. Plan and Why stay different strings (`agent_loop.py`).

## Checks

- `tensr-api`: `.venv/bin/python -m pytest -q --tb=short tests/test_control_language_and_collinearity.py tests/test_exploration_enrichment.py`
- `tensr-platform-web`: `pnpm exec playwright test tests/plan-approve-nba.spec.ts` when the card copy changes.

## Pitfall

Putting FG and FGA in the predictor list because the user said "controlling for shot volume" reintroduces the thing they asked to set aside. The shooting-factor path exists so that phrase excludes those columns. Naming a real column in "controlling for Age" should keep Age.
