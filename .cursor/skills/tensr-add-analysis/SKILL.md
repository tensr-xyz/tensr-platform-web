---
name: tensr-add-analysis
description: Add a Tensr analysis from the datasets router and stats code through the palette, the assistant allowlist, and the datasets Lambda. Use when shipping a new analysis_type.
---

# Add a Tensr analysis

Use this to take one analysis from the stats implementation to a palette item the assistant can run.

## Files

- `tensr-api/app/routers/analyze.py` — HTTP ops. Paths look like `/{dataset_id}/analyze/<op>`. This router is the allowlist source of truth.
- `tensr-api/app/assistant/constants.py` — `ALLOWED_ANALYSIS_TYPES` and `ANALYSIS_TYPE_ALIASES`. Colloquial `regression` maps to `linear_regression`.
- `tensr-api/app/assistant/agent_tools.py` — `openai_tool_definitions` puts allowlisted names on the `run_analysis.analysis_type` enum. `_unsupported_analysis_type_message` fires when the name is not in that set.
- `tensr-api/app/lambda_handlers/datasets.py` — `_mount_heavy_analysis_routes` includes `analyze.router` on first `/analyze/` request (`LazyAnalysisMiddleware`). The datasets function name is `{stage}-tensr-datasets` (`infra/stacks/datasets_stack.py`).
- `tensr-api/tests/test_analysis_type_allowlist_parity.py` — assistant allowlist must equal the FastAPI analyze routes. Alias `regression` must normalize to `linear_regression`.
- `tensr-platform-web/src/lib/analysis-definitions.ts` — labels and setup fields. `code_open_text` is the open-text op.
- `tensr-platform-web/src/configs/analysis-config/production-menu.ts` and `palette-catalog.ts` — `COMING_SOON_SECTIONS` is empty on purpose.
- `tensr-platform-web/src/configs/analysis-config/production-menu.test.ts` — palette labels must resolve to a live op.
- `tensr-api/scripts/generate_agent_capabilities_ts.py` — `--check` is the first API CI step.

## Steps

1. Implement the compute next to the existing op (router handler in `analyze.py`, or `agency.py` / `techniques.py` / `tables.py` when that family already owns it). The path segment is the canonical `analysis_type`.
2. Add that exact string to `ALLOWED_ANALYSIS_TYPES`. If people will say another name, add an alias. Do not put the alias on the route.
3. Confirm `openai_tool_definitions` picks the name up via the allowlist. Do not add a seventh tool.
4. Add the menu label in `production-menu.ts` (or `palette-catalog.ts` for an extra section) and the definition in `analysis-definitions.ts`. `getAnalysisOpForMenuName` must return the same string as the route.
5. Datasets Lambda already mounts `analyze.router`. A new path under `/analyze/` needs no second function. If the path is not under `/analyze/` and not in `_needs_heavy_analysis_routes`, the lazy mount will 404.
6. Tests: `tests/test_analysis_type_allowlist_parity.py`, a handler test beside the existing ones, `pnpm run test:menu-catalog` in the web repo, and `python scripts/generate_agent_capabilities_ts.py --check`.

## Pitfall

`regression` is not a datasets op. The error text is `**regression** is not in the allowlisted analysis set` from `_unsupported_analysis_type_message`. The route is `linear_regression`. `test_normalize_regression_alias` and `test_assistant_allowlist_equals_datasets_http_ops` fail when those names diverge. The same class of bug is `oneway_anova` vs `anova_oneway` (`test_every_allowlisted_key_is_reachable`).
