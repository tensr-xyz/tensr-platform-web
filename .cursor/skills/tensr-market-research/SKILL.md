---
name: tensr-market-research
description: Tensr nets, banners, weighting, open-end coding, and dataset merges, in the shapes DP users expect from Q and Displayr. Use when changing tables, weights, or coding.
---

# Tensr market research

Use this for survey-table work: nets, banners, weights, open ends, merges.

## Files

- Nets: `tensr-api/app/variable_nets.py`. `detect_auto_nets` suggests Top 2 / Bottom 2 on 4–7 numeric codes and Net Yes / Net No. `apply_variable_nets` copies stub nets onto the variable. Nets live on the column, not only on one table. Tests: `tensr-api/tests/test_variable_nets.py`.
- Banners / crosstabs: op name is `banner_table`. Aliases `crosstabs`, `cross_tab`, `custom_tables` map to it in `ANALYSIS_TYPE_ALIASES` (`tensr-api/app/assistant/constants.py`). Runner: `run_banner_table_for_analysis` in `tensr-api/app/tables.py`. Report matrix: `_banner_table_report_matrix` in `report_builder.py`. Agency routes in `tensr-api/app/routers/agency.py` (`banner_table`, `banner_table_refresh`, `banner_table_drill`).
- Weighting: `tensr-api/app/weights.py`. Shipping path is IPF raking to categorical margins, numeric-target calibration, capping, design-weight input, CalibrateWeight to Kish ESS. `WEIGHT_COL` is `_weight`. Not built: multistage, BRR, jackknife, bootstrap, SDR. Rake HTTP: `POST /{dataset_id}/weights/rake` in `agency.py`. Palette dialog label `Rake Weights` is required by `production-menu.test.ts`.
- Conventions: `tensr-api/app/conventions.py`. Variance modes use Q's names (`q_taylor_srs`, `q_kish_ess`, `q_frequency_weight`, `q_unweighted_n`, …). `wincross`, `spss_standard`, and `mentor` are compatibility aliases and are never stored as `variance_mode`. `quantum` and `survey_reporter` are test types, not variance modes. WinCross import is `wincross_parse` in `agency.py`.
- Open ends: `code_open_text_lexicon` in `tensr-api/app/keyword_coding.py`. Module line: keyword lexicon first, not NLP. HTTP: `run_code_open_text` in `agency.py`. Assistant hint in `constants.py` says pass lexicon and that agreement is only if two raters coded. Uncoded rows become `"uncoded"`.
- Merge: `_tool_merge_datasets` in `agent_tools.py` and `merge_datasets_route` in `tensr-api/app/routers/data_ops.py`. Provenance uses `analysis_type="merge_datasets"`.

## What the code expects a DP user to recognise

- A net is a recode of codes on the variable (Top 2 Box, Net Yes), reused by later tables. Suggest it; the user can replace it (`variable_nets.py` docstring).
- A banner is a crosstab with stubs and a banner column (`stub_column`, `banner_column` in `run_banner_table_for_analysis`). Column letters and cell comparisons are `SignificanceDisplay` in `conventions.py` (`cell_comparisons`, `column_letters`).
- Weights are a dataset column, raked to targets, and tables should say when a chart ignored them (`dispatch.py` unweighted-chart sentence). Do not invent a CVXR solver; `weights.py` documents the flipData divergence.
- Open-end coding here is a lexicon (theme → words), with a quote back to the cell. It is not an NLP topic model. The menu label is "Open-text coding" (`analysis-definitions.ts`).
- Askia is not a convention in this repo. Do not add an Askia mode. Q/Displayr names are the ones in `VARIANCE_MODES`.

## Checks

`.venv/bin/python -m pytest -q --tb=short tests/test_variable_nets.py` and the banner or weight test that covers the function you touched.
