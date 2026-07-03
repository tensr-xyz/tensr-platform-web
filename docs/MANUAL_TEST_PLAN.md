# Comprehensive prod testing plan

Use this as a run sheet against **deployed prod** (`app.tensr.xyz` → API Gateway). DevTools open: **Network** (disable cache), **Console**.

See also: [DATA_TRANSFORM_PO_GUIDE.md](./DATA_TRANSFORM_PO_GUIDE.md) for what Phase 2 items matter and prod vs local gaps.

---

## Before you start

### Environment

- [ ] Signed in with an account that has an **active subscription** (avoids 402)
- [ ] Hard refresh once (Cmd+Shift+R) so you are not seeing cached 503s
- [ ] Confirm `GET /api/tensr/datasets?scope=all` → **200** (not 503/502)

### Pass criteria (every analysis)

For each run, tick all that apply:

- [ ] Setup modal validates fields; **Run** is enabled
- [ ] Network: `POST …/analyze/<op>` → **200**
- [ ] Response has `result`, `report`, `run_id`
- [ ] Report shows **summary**, **metrics**, at least one **table**
- [ ] Charts render where expected (no blank chart blocks)
- [ ] No unhandled error toast / console exception

### Timing note

- **List/upload datasets** should be fast (cold-start fix).
- **First analyze request** after idle may take **10–25s** (heavy libs load once). Retry once if it times out at 29s.
- Run **Sprint 10 analyses last** in a session (or accept one slow first hit).

---

## Phase 0 — Platform smoke (15 min)

| #   | Test             | Steps                                                             | Pass                       |
| --- | ---------------- | ----------------------------------------------------------------- | -------------------------- |
| 0.1 | Auth             | Sign in / out; reload while signed in                             | Session persists           |
| 0.2 | Dataset list     | Open workspace; datasets load                                     | 200, JSON array            |
| 0.3 | Upload           | Upload CSV (see Phase 1)                                          | Dataset appears in list    |
| 0.4 | Preview          | Open dataset; grid shows rows                                     | Headers + data visible     |
| 0.5 | Schema           | Column types look correct                                         | Numeric / categorical sane |
| 0.6 | Analysis history | Run any quick analysis; check runs list if exposed                | `run_id` returned          |
| 0.7 | Subscription     | Without sub (if you have a test account): analyze returns **402** | Gate works                 |

**0.4 / 0.5** are read-only views of stored data and inferred schema. They update when you open a different dataset or after a data-prep action that creates a derived dataset.

---

## Phase 1 — Test dataset (required)

Upload **one CSV** with ≥36 rows and these columns (matches backend test fixture):

**Identifiers / groups:** `subject`, `group`, `factor_b`, `surv_group`  
**Outcomes / predictors:** `outcome`, `y1`, `y2`, `x1`, `x2`, `item1`, `item2`, `item3`  
**Paired / agreement:** `before`, `after`, `rater_a`, `rater_b`  
**Categorical / count:** `category`, `count_out`, `ord_level`, `bin1`, `bin2`, `bin3`, `dose_ord`  
**Time series:** `date`, `ts_value`  
**Survival:** `duration`, `event`

If you do not have this file, run locally once:

```bash
cd tensr-api && source .venv/bin/activate
python3 -c "from tests.conftest import ANALYZE_FIXTURE_CSV; open('/tmp/tensr-test-fixture.csv','w').write(ANALYZE_FIXTURE_CSV)"
```

Upload `/tmp/tensr-test-fixture.csv` to prod.

- [ ] Fixture uploaded and selected as active dataset for all tests below

---

## Phase 2 — Data & transform (minimal PO sign-off)

| #   | Menu                              | Action                           | Pass                                   |
| --- | --------------------------------- | -------------------------------- | -------------------------------------- |
| 2.1 | Data → Data Quality Report        | Run on fresh upload              | Report with missing/invalid summary    |
| 2.2 | Data → Find Duplicates            | Pick ID columns (e.g. `subject`) | Duplicate list or “none”               |
| 2.3 | Transform → Standardize Variables | Standardize `x1`, `x2`           | New `_z` columns or transformed values |

**Optional (not required for minimal PO sign-off):**

| #   | Menu                              | Action                                   |
| --- | --------------------------------- | ---------------------------------------- |
| 2.4 | Transform → Rank Cases            | Rank `outcome`                           |
| —   | Column header → Measurement level | Set Scale / Ordinal / Nominal; no reload |

---

## Phase 3 — Analyze tab (core stats)

Use **Analyze** palette unless noted. Same dataset throughout.

### Descriptive & frequencies

| #   | Analysis     | Variables             | Expect                         |
| --- | ------------ | --------------------- | ------------------------------ |
| 3.1 | Descriptives | `x1`, `x2`            | Mean, SD, N table              |
| 3.2 | Crosstabs    | `rater_a` × `rater_b` | Contingency table + chi-square |

### Compare means

| #   | Analysis                   | Variables                        | Expect                   |
| --- | -------------------------- | -------------------------------- | ------------------------ |
| 3.3 | Independent-Samples T Test | Group: `group`, Value: `outcome` | t, df, p, group means    |
| 3.4 | Paired-Samples T Test      | `before`, `after`                | Paired t table           |
| 3.5 | One-Sample T Test          | `outcome`, μ=10                  | t vs hypothesized mean   |
| 3.6 | One-Way ANOVA              | `group`, `outcome`               | F-table, group stats     |
| 3.7 | Hotelling's T²             | Group: `group`, DVs: `x1`, `x2`  | Multivariate test output |

### Nonparametric

| #    | Analysis             | Variables                 | Expect            |
| ---- | -------------------- | ------------------------- | ----------------- |
| 3.8  | Mann-Whitney U       | `group`, `outcome`        | U, p              |
| 3.9  | Kruskal-Wallis H     | `group`, `outcome`        | H, p              |
| 3.10 | Wilcoxon Signed-Rank | `before`, `after`         | W, p              |
| 3.11 | Friedman Test        | `item1`, `item2`, `item3` | χ², p             |
| 3.12 | Kolmogorov-Smirnov   | Two-sample: `x1` vs `x2`  | D, p              |
| 3.13 | Median Test          | `group`, `outcome`        | Median test table |
| 3.14 | Runs Test            | `x1`, cutoff median       | Runs statistic    |
| 3.15 | Jonckheere–Terpstra  | `dose_ord`, `outcome`     | J-T statistic     |
| 3.16 | Moses Test           | `group`, `outcome`        | Moses output      |
| 3.17 | Cochran's Q          | `bin1`, `bin2`, `bin3`    | Q statistic       |
| 3.18 | Lilliefors K–S       | `x1`                      | Normality test    |

### Reliability & correlation

| #    | Analysis               | Variables                          | Expect             |
| ---- | ---------------------- | ---------------------------------- | ------------------ |
| 3.19 | Reliability Analysis   | `item1`–`item3`                    | Cronbach's α       |
| 3.20 | Bivariate Correlations | `x1`, `x2`, `y1`                   | Correlation matrix |
| 3.21 | Partial Correlation    | X: `x1`, Y: `y1`, control: `x2`    | Partial r, p       |
| 3.22 | Canonical Correlation  | Set A: `x1`,`x2`; Set B: `y1`,`y2` | Canonical coeffs   |

### Dimension reduction

| #    | Analysis | Variables                     | Expect                        |
| ---- | -------- | ----------------------------- | ----------------------------- |
| 3.23 | PCA      | `item1`–`item3`               | Loadings / variance explained |
| 3.24 | EFA      | `item1`–`item3`               | Factor loadings               |
| 3.25 | MDS      | `item1`–`item3`, 2 components | Stress / coordinates          |

### GLM

| #    | Analysis                | Variables                                           | Expect             |
| ---- | ----------------------- | --------------------------------------------------- | ------------------ |
| 3.26 | Two-Way ANOVA           | A: `group`, B: `factor_b`, DV: `outcome`            | Main + interaction |
| 3.27 | Repeated Measures ANOVA | Subject: `subject`, measures: `item1`–`item3`       | RM-ANOVA table     |
| 3.28 | MANOVA                  | Group: `group`, DVs: `y1`, `y2`                     | Multivariate F     |
| 3.29 | ANCOVA                  | Group: `group`, outcome: `outcome`, covariate: `x1` | Adjusted means     |

### Classification

| #    | Analysis              | Variables                              | Expect                   |
| ---- | --------------------- | -------------------------------------- | ------------------------ |
| 3.30 | Discriminant Analysis | Group: `group`, predictors: `x1`, `x2` | Classification functions |
| 3.31 | Cluster Analysis      | `x1`, `x2`, k=2                        | Cluster sizes / plot     |
| 3.32 | Decision Tree         | DV: `category`, predictors: `x1`, `x2` | Tree metrics             |

### Regression

| #    | Analysis            | Variables                       | Expect              |
| ---- | ------------------- | ------------------------------- | ------------------- |
| 3.33 | Linear Regression   | DV: `outcome`, IVs: `x1`, `x2`  | Coef table, R²      |
| 3.34 | Stepwise Regression | Same                            | Selected predictors |
| 3.35 | Binary Logistic     | DV: `category`, IVs: `x1`, `x2` | OR table            |
| 3.36 | Poisson             | DV: `count_out`, IV: `x1`       | IRR / coef          |
| 3.37 | Negative Binomial   | DV: `count_out`, IV: `x1`       | Coef table          |
| 3.38 | Ordinal Regression  | DV: `ord_level`, IV: `x1`       | Threshold / coef    |
| 3.39 | Probit Regression   | DV: `category`, IVs: `x1`, `x2` | Probit coef         |

### Agreement & normality

| #    | Analysis      | Variables            | Expect         |
| ---- | ------------- | -------------------- | -------------- |
| 3.40 | Cohen's Kappa | `rater_a`, `rater_b` | κ, p           |
| 3.41 | Shapiro–Wilk  | `x1`                 | W, p           |
| 3.42 | Sign Test     | `before`, `after`    | Sign test stat |
| 3.43 | McNemar       | `rater_a`, `rater_b` | McNemar χ²     |

---

## Phase 4 — Time series & survival tab

| #   | Analysis              | Variables                                                 | Expect                        |
| --- | --------------------- | --------------------------------------------------------- | ----------------------------- |
| 4.1 | ARIMA / SARIMA        | Target: `ts_value`, Date: `date`, seasonal=12, forecast=6 | Forecast chart + table        |
| 4.2 | Exponential Smoothing | Same                                                      | Forecast chart                |
| 4.3 | STL Decomposition     | Target: `ts_value`, Date: `date`, period=12               | Trend/seasonal/residual chart |
| 4.4 | Stationarity Tests    | `ts_value`, `date`                                        | ADF + KPSS tables             |
| 4.5 | Autocorrelation       | `ts_value`, max lags=12                                   | ACF + PACF charts             |
| 4.6 | Kaplan-Meier          | Duration: `duration`, Event: `event`, Group: `surv_group` | Survival curve                |
| 4.7 | Cox PH                | Duration/event as above, covariate: `x1`                  | Coef + HR table               |
| 4.8 | Nelson-Aalen          | Duration: `duration`, Event: `event`                      | Cumulative hazard chart       |

---

## Phase 5 — ML & AI tab

| #   | Analysis                            | Variables                                  | Expect                |
| --- | ----------------------------------- | ------------------------------------------ | --------------------- |
| 5.1 | Random Forest Classification        | DV: `category`, IVs: `x1`, `x2`            | Accuracy / confusion  |
| 5.2 | Random Forest Regression            | DV: `outcome`, IVs: `x1`, `x2`             | R² / RMSE             |
| 5.3 | SVM Classification                  | DV: `category`, IVs: `x1`, `x2`            | Accuracy metrics      |
| 5.4 | Gradient Boosting (Classification)  | DV: `category`, IVs: `x1`, `x2`            | Metrics table         |
| 5.5 | Gradient Boosting (Regression)      | DV: `outcome`, IVs: `x1`, `x2`             | Metrics table         |
| 5.6 | Neural Network MLP (Classification) | DV: `category`, IVs: `x1`, `x2`            | Metrics               |
| 5.7 | Neural Network MLP (Regression)     | DV: `outcome`, IVs: `x1`, `x2`             | Metrics               |
| 5.8 | DBSCAN                              | Features: `x1`, `x2`, ε=1.5, min_samples=3 | Cluster labels / plot |

---

## Phase 6 — Multivariate tab (Sprint 10) — run in order

### 6.1 Linear Mixed Model (LMM)

- **Menu:** Multivariate → Mixed Models → LMM
- **Fields:** Dependent: `outcome` | Fixed effects: `item1`, `item2` | Group: `group`
- **Pass:**
  - [ ] Fixed-effects coefficient table (estimate, SE, p)
  - [ ] Random-effects summary (group variance)
  - [ ] **Fitted vs residual** scatter chart

### 6.2 Generalized LMM (GLMM) — binomial

- **Menu:** Multivariate → GLMM
- **Fields:** Family: **Binomial** | Dependent: `category` | Fixed: `item1`, `item2` | Group: `group`
- **Pass:**
  - [ ] Coefficient table
  - [ ] Random-effects summary
  - [ ] Fitted vs residual chart

### 6.3 GLMM — poisson (second run)

- **Fields:** Family: **Poisson** | Dependent: `count_out` | Fixed: `x1` | Group: `group`
- **Pass:** Same as 6.2 (Poisson family completes without error)

### 6.4 Multilevel Modelling (HLM)

- **Menu:** Multivariate → HLM
- **Fields:** Outcome: `outcome` | Level-1 predictors: `item1`, `item2` | Level-2 group: `group`
- **Pass:**
  - [ ] **ICC** in metrics
  - [ ] Fixed-effects table
  - [ ] Random intercept / slopes chart (if shown)

### 6.5 Latent Class Analysis (LCA)

- **Menu:** Multivariate → LCA
- **Fields:** Indicators: `bin1`, `bin2`, `bin3` | Classes: **2**
- **Pass:**
  - [ ] Class membership probabilities table
  - [ ] Class sizes in metrics
  - [ ] **Profile bar chart** per class

### 6.6 Confirmatory Factor Analysis (CFA)

- **Menu:** Multivariate → CFA
- **Fields:** Indicators: `item1`, `item2`, `item3`
- **Model spec:**
  ```
  F1 =~ item1 + item2 + item3
  ```
- **Pass:**
  - [ ] Factor loadings table
  - [ ] Fit indices: **CFI**, **RMSEA**, **SRMR** (metrics or table)
  - [ ] **Path diagram** chart (latent ellipse + observed boxes)

### 6.7 Structural Equation Modelling (SEM)

- **Menu:** Multivariate → SEM
- **Model spec:**
  ```
  F1 =~ item1 + item2 + item3
  outcome ~ F1 + x1
  ```
- **Observed variables (optional):** `item1`, `item2`, `item3`, `outcome`, `x1`
- **Pass:**
  - [ ] Path coefficients table
  - [ ] Fit indices (CFI, RMSEA, SRMR)
  - [ ] **SEM path diagram** with structural paths labelled

---

## Phase 7 — Charts & visualization (10 min)

| #   | Test                                      | Pass                                                |
| --- | ----------------------------------------- | --------------------------------------------------- |
| 7.1 | Charts palette → standalone chart builder | Bar/scatter from columns renders                    |
| 7.2 | Report-attached charts from Phase 3–6     | Histogram, scatter, boxplot, bar_grouped all render |
| 7.3 | CFA/SEM path diagram                      | Nodes + edges visible, not empty SVG                |

---

## Phase 8 — Assistant (optional, 10 min)

| #   | Test                                           | Pass                                          |
| --- | ---------------------------------------------- | --------------------------------------------- |
| 8.1 | Ask: “Run a t-test comparing outcome by group” | Suggested analysis = `ttest_independent`      |
| 8.2 | Apply to form → Run                            | Same result as manual 3.3                     |
| 8.3 | Follow-up on last result                       | Grounded answer, no invented numbers          |
| 8.4 | Explain structured                             | Sections: what test / found / means / caveats |

---

## Phase 9 — Regression / failure log

Keep a simple log as you go:

| ID  | Analysis | Status | HTTP | Notes |
| --- | -------- | ------ | ---- | ----- |
| 6.1 | LMM      | ☐      |      |       |
| …   |          |        |      |       |

**Status codes:**

- **Pass** — all pass criteria met
- **Slow** — succeeded after retry / >20s
- **Fail** — 4xx/5xx or broken report
- **Skip** — missing column in your dataset

---

## Suggested run order (one sitting)

1. Phase 0 + upload fixture (**Phase 1**)
2. Phase 2 (minimal: 2.1–2.3)
3. Phase 3 — pick **5 spot checks** if time-limited: 3.3, 3.33, 3.23, 3.26, 3.40
4. Phase 4 — all 8 (Sprint 9)
5. Phase 5 — spot check 5.1 + 5.8
6. **Phase 6 — all 7 Sprint 10 items in order** (most important)
7. Phase 7–8 as time allows

**Full pass:** all Phase 0 + Phase 6 + no 503 on dataset list.  
**Extended pass:** all rows in Phases 3–6 checked.

---

## If something fails

| Symptom                               | Check                                                                |
| ------------------------------------- | -------------------------------------------------------------------- |
| 503 on `/api/tensr/datasets`          | CloudWatch `prod-tensr-datasets`; cold-start fix deployed?           |
| 503 only on first analyze             | Retry once; expected on cold container                               |
| 504 / timeout at 29s                  | Heavy analysis on cold Lambda; retry or warm with descriptives first |
| 402                                   | Subscription / billing                                               |
| 400 on SEM/CFA                        | Model spec syntax; enough complete rows                              |
| Empty path diagram                    | Report has `path_diagram` chart block; hard refresh                  |
| 404 on DQR / duplicates / standardize | `data_ops` not mounted on prod Lambda yet                            |
