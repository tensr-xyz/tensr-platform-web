# Data & Transform — product owner guide

Phase 2 in the test plan is **“clean the dataset before analysis.”** Not everything in those menus is equally important, and a few items are **not fully live on prod yet**.

---

## How the menus are meant to work

Tensr follows a familiar statistical workflow — import, inspect, prepare, analyze — but as a **modern, browser-native product**, not a desktop clone. Measurement levels and metadata live on columns; heavy type-casting workflows are intentionally lightweight.

1. **Data** — get data in, inspect it, fix structural problems
2. **Transform** — create or reshape variables for analysis
3. **Analyze** — run statistics on a dataset you trust

Almost all prep/transform actions **create a new dataset** (e.g. `myfile_standardized.csv`). The original upload is kept. That matches reproducible data prep but can surprise users who expect in-place edits.

**Measurement levels** (Scale / Ordinal / Nominal) are set per column from the column header menu and persist via metadata only — no new dataset, no reload.

---

## Data menu

### Import & Export

| Item            | What it does                            | PO priority                            |
| --------------- | --------------------------------------- | -------------------------------------- |
| **Import Data** | Upload CSV/Excel → dataset in workspace | **Core** — every user flow starts here |
| **Export Data** | Download current dataset                | **Core** — sharing / backup            |

### Data preparation

| Item                    | What it does                                             | When users need it                           | PO priority                    |
| ----------------------- | -------------------------------------------------------- | -------------------------------------------- | ------------------------------ |
| **Find Duplicates**     | Flags rows that repeat on chosen ID columns              | Panel/longitudinal data, bad joins           | **High** — quick sanity check  |
| **Data Quality Report** | Read-only summary: missing %, types, outliers per column | First look after import; before any analysis | **High** — best “Phase 2” item |
| **Handle Missing Data** | Fill gaps (mean, median, custom value, etc.)             | Before analyses that need complete cases     | **Medium** — common prep step  |
| **Merge Datasets**      | Stack rows (add cases) or join columns (add variables)   | Multi-file studies                           | **Medium** — power users only  |

---

## Transform menu

| Item                       | What it does                                     | PO priority                                                                     |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Standardize Variables**  | Z-scores numeric columns → new `*_z` columns     | **High** — needed for many ML/cluster paths                                     |
| **Rank Cases**             | Rank order within column(s)                      | **Medium** — niche                                                              |
| **Recode Variables**       | Map old values → new (e.g. 1/2 → labels)         | **Medium**                                                                      |
| **Visual Binning**         | Cut continuous variable into groups              | **Medium** — segmentation                                                       |
| **Lag Cases / Lead Cases** | Shift values down/up rows (time series / panels) | **Low** — time series users                                                     |
| **Compute Variable**       | Build new column from formula                    | **Not ready** — UI calls an API route that **doesn’t exist** in current backend |
| **Count Values**           | Frequency of values in a column                  | **Not ready** — same issue                                                      |

**Shift Values** in the menu registry maps to a dialog; lag/lead are the main wired shift operations.

---

## What Phase 2 should actually test (recommended)

For a PO sign-off, you don’t need every transform item. Use this **minimal Phase 2**:

| #       | Test                                          | Why it matters                                       |
| ------- | --------------------------------------------- | ---------------------------------------------------- |
| **2.1** | **Data Quality Report** on fresh upload       | Confirms import + schema inference; no data mutation |
| **2.2** | **Find Duplicates** on `subject` (or similar) | Confirms data prep API + sensible output             |
| **2.3** | **Standardize Variables** on `x1`, `x2`       | Confirms transform pipeline; new `_z` columns for ML |

**Can skip for PO sign-off (unless you’re targeting those users):**

- Merge Datasets
- Handle Missing Data
- Rank, Recode, Binning, Lag/Lead
- Compute Variable, Count Values (**skip entirely until backend exists**)

**Measurement level (column header menu):** set Scale / Ordinal / Nominal on one numeric and one text column; confirm active state and no dataset reload.

---

## Prod vs local (why testing felt “unsure”)

| Capability                                                     | Local dev (uvicorn) | Deployed prod (datasets Lambda)                         |
| -------------------------------------------------------------- | ------------------- | ------------------------------------------------------- |
| Preview / Schema (0.4 / 0.5)                                   | ✅                  | ✅                                                      |
| Upload / list datasets                                         | ✅                  | ✅                                                      |
| Column metadata / measurement level (`PUT …/metadata`)         | ✅                  | ✅                                                      |
| **Data prep + Transform (DQR, duplicates, standardize, etc.)** | ✅                  | ⚠️ **`data_ops` routes not mounted on prod Lambda yet** |

So on prod today, **Import + Preview + Schema + measurement level + Analyze** work; **DQR, Standardize, Find Duplicates, etc. may 404** until `data_ops` is wired into the datasets stack (same as local monolith).

PO takeaway: **Phase 2 full prep testing is a local/after-infra-fix activity** unless you’ve already deployed that wiring.

---

## How this fits the bigger test plan

```
Phase 0  → Can I sign in and see my data?          (must pass on prod)
Phase 2  → Can I clean/prepare data?               (minimal 3 tests above; prod blocked until data_ops deployed)
Phase 3+ → Can I run analyses?                     (main product value — prod)
Phase 6  → Sprint 10 multivariate/SEM             (prod, after analyze cold-start fix)
```

**For the product owner:** Phase 2 is **supporting**, not the headline. Minimum bar on prod is **Phase 0 + representative Analyze + Sprint 10**. Phase 2 becomes mandatory once data prep is on prod and you’re selling browser-native data prep alongside analysis.

---

## One-line menu summary for stakeholders

- **Data** = “Is my file OK, and can I fix structure (duplicates, missing, merges)?”
- **Transform** = “Can I create analysis-ready variables (standardized, recoded, binned, ranked)?”
- **Analyze** = “Run the stats.”
