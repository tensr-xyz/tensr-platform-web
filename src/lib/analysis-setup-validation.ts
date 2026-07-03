import type { DatasetPreview } from '@/lib/analysis-report-types';

import {
  columnSlotType,
  slotTypeMatchesExpected,
  type ColumnSlotType,
} from '@/lib/analysis-column-types';
import type { AnalysisFormState, AnalysisKey } from '@/lib/analysis-definitions';
import type { SchemaColumn } from '@/lib/analysis-report-types';

/** Field ids for inline warnings and errors in the analysis setup dialog. */
export const WIZARD_FIELD = {
  columns: 'columns',
  groupCol: 'groupCol',
  valueCol: 'valueCol',
  depCol: 'depCol',
  independentCols: 'independentCols',
  chiA: 'chiA',
  chiB: 'chiB',
  pairedVar1: 'pairedVar1',
  pairedVar2: 'pairedVar2',
  oneSampleCol: 'oneSampleCol',
  hypothesizedMean: 'hypothesizedMean',
  confidenceLevel: 'confidenceLevel',
  correlationMethod: 'correlationMethod',
  anovaPostHoc: 'anovaPostHoc',
  hypothesizedDifference: 'hypothesizedDifference',
  regressionMethod: 'regressionMethod',
  logisticCutoff: 'logisticCutoff',
  logisticMaxIterations: 'logisticMaxIterations',
  dateCol: 'dateCol',
  durationCol: 'durationCol',
  eventCol: 'eventCol',
  seasonalPeriod: 'seasonalPeriod',
  forecastSteps: 'forecastSteps',
  acfMaxLags: 'acfMaxLags',
  semModelSpec: 'semModelSpec',
} as const;

export type WizardFieldId = (typeof WIZARD_FIELD)[keyof typeof WIZARD_FIELD];

export type WizardFieldNotice = {
  level: 'warning';
  message: string;
  remedy?: string;
};

export type WizardFieldNoticesMap = Partial<Record<WizardFieldId, WizardFieldNotice[]>>;

export type WizardFieldErrorsMap = Partial<Record<WizardFieldId, string[]>>;

function columnStrings(preview: DatasetPreview, col: string): string[] {
  const idx = preview.headers.indexOf(col);
  if (idx < 0) return [];
  const out: string[] = [];
  for (const row of preview.rows) {
    const v = row[idx];
    if (v != null && v !== '') out.push(String(v));
  }
  return out;
}

function counts(values: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

function minExpectedChiSquare(preview: DatasetPreview, colA: string, colB: string): number | null {
  const aIdx = preview.headers.indexOf(colA);
  const bIdx = preview.headers.indexOf(colB);
  if (aIdx < 0 || bIdx < 0) return null;
  const ct = new Map<string, Map<string, number>>();
  let n = 0;
  for (const row of preview.rows) {
    const av = row[aIdx];
    const bv = row[bIdx];
    if (av == null || av === '' || bv == null || bv === '') continue;
    const ka = String(av);
    const kb = String(bv);
    if (!ct.has(ka)) ct.set(ka, new Map());
    const inner = ct.get(ka)!;
    inner.set(kb, (inner.get(kb) ?? 0) + 1);
    n += 1;
  }
  if (n === 0) return null;
  const rows = [...ct.keys()];
  const cols = new Set<string>();
  for (const inner of ct.values()) for (const k of inner.keys()) cols.add(k);
  const colList = [...cols];
  const rowMargin = new Map<string, number>();
  const colMargin = new Map<string, number>();
  for (const r of rows) {
    let s = 0;
    const inner = ct.get(r)!;
    for (const c of colList) s += inner.get(c) ?? 0;
    rowMargin.set(r, s);
  }
  for (const c of colList) {
    let s = 0;
    for (const r of rows) s += ct.get(r)?.get(c) ?? 0;
    colMargin.set(c, s);
  }
  let minE = Infinity;
  for (const r of rows) {
    const rs = rowMargin.get(r)!;
    for (const c of colList) {
      const cs = colMargin.get(c)!;
      const expected = (rs * cs) / n;
      if (expected < minE) minE = expected;
    }
  }
  return Number.isFinite(minE) ? minE : null;
}

function pushNotice(map: WizardFieldNoticesMap, field: WizardFieldId, notice: WizardFieldNotice) {
  if (!map[field]) map[field] = [];
  map[field]!.push(notice);
}

function pushError(map: WizardFieldErrorsMap, field: WizardFieldId, message: string) {
  if (!map[field]) map[field] = [];
  map[field]!.push(message);
}

function appendRequiredFieldErrors(
  op: AnalysisKey,
  form: AnalysisFormState,
  schema: SchemaColumn[],
  errors: WizardFieldErrorsMap
) {
  const numericNames = schema
    .filter(c => columnSlotType(schema, c.name) === 'numeric')
    .map(c => c.name);

  const require = (field: WizardFieldId, ok: boolean, message: string) => {
    if (!ok) pushError(errors, field, message);
  };

  switch (op) {
    case 'descriptives':
      require(WIZARD_FIELD.columns, Object.values(form.descriptiveStats).some(
        Boolean
      ), 'Select at least one statistic to compute.');
      break;
    case 'correlation': {
      const cols = form.selectedCols.length
        ? form.selectedCols.filter(c => numericNames.includes(c))
        : numericNames;
      require(WIZARD_FIELD.columns, cols.length >= 2, 'Select at least two numeric columns.');
      break;
    }
    case 'ttest_independent':
    case 'mann_whitney_u':
    case 'anova_oneway':
    case 'kruskal_wallis':
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select a grouping variable.');
      require(WIZARD_FIELD.valueCol, !!form.valueCol?.trim(), 'Select an outcome variable.');
      break;
    case 'ttest_paired':
    case 'wilcoxon_signed_rank':
      require(WIZARD_FIELD.pairedVar1, !!form.pairedBeforeCol?.trim(), 'Select the first variable.');
      require(WIZARD_FIELD.pairedVar2, !!form.pairedAfterCol?.trim(), 'Select the second variable.');
      break;
    case 'friedman':
      require(WIZARD_FIELD.columns, form.selectedCols.filter(c => numericNames.includes(c))
        .length >= 3, 'Select at least three numeric measure columns.');
      break;
    case 'reliability_cronbach':
      require(WIZARD_FIELD.columns, form.selectedCols.filter(c => numericNames.includes(c))
        .length >= 2, 'Select at least two numeric items.');
      break;
    case 'kolmogorov_smirnov':
      if (form.ksTestType === 'normality') {
        require(WIZARD_FIELD.pairedVar1, !!form.pairedBeforeCol?.trim(), 'Select a variable to test.');
      } else {
        require(WIZARD_FIELD.pairedVar1, !!form.pairedBeforeCol?.trim(), 'Select the first sample.');
        require(WIZARD_FIELD.pairedVar2, !!form.pairedAfterCol?.trim(), 'Select the second sample.');
      }
      break;
    case 'ttest_one_sample':
      require(WIZARD_FIELD.oneSampleCol, !!form.oneSampleCol?.trim(), 'Select a test variable.');
      require(WIZARD_FIELD.hypothesizedMean, form.hypothesizedMean.trim() !== '' &&
        !Number.isNaN(Number(form.hypothesizedMean)), 'Enter a valid hypothesized mean.');
      break;
    case 'linear_regression':
    case 'logistic_regression':
    case 'stepwise_regression':
    case 'poisson_regression':
      require(WIZARD_FIELD.depCol, !!form.depCol?.trim(), 'Select a dependent variable.');
      require(WIZARD_FIELD.independentCols, form.independentCols.length >
        0, 'Add at least one predictor.');
      break;
    case 'chi_square':
    case 'fishers_exact':
    case 'odds_ratio':
    case 'relative_risk':
    case 'goodman_kruskal_gamma':
    case 'somers_d':
    case 'goodman_kruskal_lambda':
    case 'weighted_kappa':
      require(WIZARD_FIELD.chiA, !!form.chiA?.trim(), 'Select the first variable.');
      require(WIZARD_FIELD.chiB, !!form.chiB?.trim(), 'Select the second variable.');
      break;
    case 'cohens_kappa':
      require(WIZARD_FIELD.chiA, !!form.chiA?.trim(), 'Select the first rater variable.');
      require(WIZARD_FIELD.chiB, !!form.chiB?.trim(), 'Select the second rater variable.');
      break;
    case 'fleiss_kappa':
      require(WIZARD_FIELD.columns, form.selectedCols.length >=
        3, 'Select at least three rater columns.');
      break;
    case 'kendalls_w':
      require(WIZARD_FIELD.columns, form.selectedCols.length >=
        2, 'Select at least two judge/rank columns.');
      break;
    case 'mantel_haenszel':
    case 'cochran_armitage':
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select an ordered group variable.');
      require(WIZARD_FIELD.valueCol, !!form.valueCol?.trim(), 'Select a binary outcome variable.');
      break;
    case 'loglinear':
      require(WIZARD_FIELD.columns, form.selectedCols.length >=
        2, 'Select at least two categorical variables.');
      break;
    case 'hierarchical_regression':
      require(WIZARD_FIELD.depCol, !!form.depCol?.trim(), 'Select a dependent variable.');
      require(WIZARD_FIELD.independentCols, form.independentCols.length >
        0, 'Add at least one block 1 predictor.');
      break;
    case 'anova_mixed':
      require(WIZARD_FIELD.groupCol, !!form.subjectCol?.trim(), 'Select a subject ID column.');
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select a between-subjects factor.');
      require(WIZARD_FIELD.columns, form.selectedCols.length >=
        2, 'Select at least two within-subject measures.');
      break;
    case 'anova_threeway':
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select factor A.');
      require(WIZARD_FIELD.valueCol, !!form.valueCol?.trim(), 'Select the dependent variable.');
      require(WIZARD_FIELD.groupCol, !!form.factorBCol?.trim(), 'Select factor B.');
      require(WIZARD_FIELD.groupCol, !!form.factorCCol?.trim(), 'Select factor C.');
      break;
    case 'moderation_analysis':
      require(WIZARD_FIELD.depCol, !!form.depCol?.trim(), 'Select an outcome variable.');
      require(WIZARD_FIELD.valueCol, !!form.valueCol?.trim(), 'Select a predictor variable.');
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select a moderator variable.');
      break;
    case 'partial_correlation':
      require(WIZARD_FIELD.pairedVar1, !!form.pairedBeforeCol?.trim(), 'Select variable X.');
      require(WIZARD_FIELD.pairedVar2, !!form.pairedAfterCol?.trim(), 'Select variable Y.');
      break;
    case 'pca':
    case 'efa':
      require(WIZARD_FIELD.columns, form.selectedCols.filter(c => numericNames.includes(c))
        .length >= 2, 'Select at least two numeric variables.');
      break;
    case 'cluster_analysis':
      require(WIZARD_FIELD.columns, form.selectedCols.filter(c => numericNames.includes(c))
        .length >= 1, 'Select at least one numeric variable.');
      break;
    case 'discriminant_analysis':
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select a grouping variable.');
      require(WIZARD_FIELD.columns, form.selectedCols.filter(c => numericNames.includes(c))
        .length >= 1, 'Select at least one predictor.');
      break;
    case 'manova':
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select a grouping variable.');
      require(WIZARD_FIELD.columns, form.selectedCols.filter(c => numericNames.includes(c))
        .length >= 2, 'Select at least two dependent variables.');
      break;
    case 'ancova':
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select a factor variable.');
      require(WIZARD_FIELD.valueCol, !!form.valueCol?.trim(), 'Select an outcome variable.');
      require(WIZARD_FIELD.depCol, !!form.covariateCol?.trim(), 'Select a covariate.');
      break;
    case 'decision_tree':
    case 'random_forest_classification':
    case 'svm_classification':
    case 'random_forest_regression':
    case 'gradient_boosting':
    case 'neural_network_mlp':
      require(WIZARD_FIELD.depCol, !!form.depCol?.trim(), 'Select a target variable.');
      require(WIZARD_FIELD.independentCols, form.independentCols.length >
        0, 'Add at least one feature.');
      break;
    case 'dbscan':
      require(WIZARD_FIELD.columns, form.selectedCols.filter(c => numericNames.includes(c))
        .length >= 1, 'Select at least one numeric feature.');
      break;
    case 'arima_sarima':
    case 'exponential_smoothing':
    case 'stl_decomposition':
    case 'stationarity_tests':
    case 'autocorrelation':
      require(WIZARD_FIELD.valueCol, !!form.valueCol?.trim(), 'Select a series variable.');
      break;
    case 'kaplan_meier':
    case 'nelson_aalen':
      require(WIZARD_FIELD.durationCol, !!form.durationCol?.trim(), 'Select a duration column.');
      require(WIZARD_FIELD.eventCol, !!form.eventCol?.trim(), 'Select an event column.');
      break;
    case 'cox_proportional_hazards':
      require(WIZARD_FIELD.durationCol, !!form.durationCol?.trim(), 'Select a duration column.');
      require(WIZARD_FIELD.eventCol, !!form.eventCol?.trim(), 'Select an event column.');
      require(WIZARD_FIELD.independentCols, form.independentCols.length >
        0, 'Add at least one covariate.');
      break;
    case 'anova_twoway':
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select factor A.');
      require(WIZARD_FIELD.valueCol, !!form.factorBCol?.trim(), 'Select factor B.');
      require(WIZARD_FIELD.depCol, !!form.valueCol?.trim(), 'Select an outcome variable.');
      break;
    case 'anova_repeated':
      require(WIZARD_FIELD.groupCol, !!form.subjectCol?.trim(), 'Select a subject identifier.');
      require(WIZARD_FIELD.columns, form.selectedCols.filter(c => numericNames.includes(c))
        .length >= 2, 'Select at least two measure columns.');
      break;
    case 'linear_mixed_model':
    case 'generalized_linear_mixed_model':
      require(WIZARD_FIELD.depCol, !!form.depCol?.trim(), 'Select a dependent variable.');
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select a grouping variable.');
      require(WIZARD_FIELD.independentCols, form.independentCols.length >
        0, 'Add at least one fixed effect.');
      break;
    case 'multilevel_modelling':
      require(WIZARD_FIELD.valueCol, !!form.valueCol?.trim(), 'Select an outcome variable.');
      require(WIZARD_FIELD.groupCol, !!form.groupCol?.trim(), 'Select a grouping variable.');
      require(WIZARD_FIELD.independentCols, form.independentCols.length >
        0, 'Add at least one predictor.');
      break;
    case 'latent_class_analysis':
      require(WIZARD_FIELD.columns, form.selectedCols.length >=
        1, 'Select at least one indicator.');
      break;
    case 'confirmatory_factor_analysis':
      require(WIZARD_FIELD.columns, form.selectedCols.filter(c => numericNames.includes(c))
        .length >= 2, 'Select at least two numeric indicators.');
      require(WIZARD_FIELD.semModelSpec, !!form.semModelSpec.trim(), 'Enter a factor structure.');
      break;
    case 'structural_equation_modelling':
      require(WIZARD_FIELD.semModelSpec, !!form.semModelSpec.trim(), 'Enter a model specification.');
      break;
    default:
      break;
  }
}

function appendPreviewBlockingErrors(
  op: AnalysisKey,
  form: AnalysisFormState,
  preview: DatasetPreview | null,
  errors: WizardFieldErrorsMap,
  schema: SchemaColumn[]
) {
  if (!preview?.rows.length) return;

  if (
    op === 'ttest_independent' ||
    op === 'mann_whitney_u' ||
    op === 'anova_oneway' ||
    op === 'kruskal_wallis'
  ) {
    if (!form.groupCol?.trim()) return;
    const k = countPreviewDistinctNonEmpty(preview, form.groupCol);
    if (k == null) return;
    if ((op === 'ttest_independent' || op === 'mann_whitney_u') && k !== 2) {
      pushError(
        errors,
        WIZARD_FIELD.groupCol,
        `Grouping variable must have exactly 2 groups for this test (${k} found in the dataset preview). Recode or filter the variable before running.`
      );
    }
    if ((op === 'anova_oneway' || op === 'kruskal_wallis') && k < 2) {
      pushError(
        errors,
        WIZARD_FIELD.groupCol,
        'Grouping variable needs at least 2 groups in the dataset preview.'
      );
    }
    if (op === 'anova_oneway' && form.anovaPostHoc === 'tukey' && k > 50) {
      pushError(
        errors,
        WIZARD_FIELD.anovaPostHoc,
        'Tukey HSD allows at most 50 groups. Choose None for post-hoc or use a coarser grouping variable.'
      );
    }
  }

  if (op === 'logistic_regression' && form.depCol?.trim()) {
    const k = countPreviewDistinctNonEmpty(preview, form.depCol);
    if (k != null && k !== 2) {
      pushError(
        errors,
        WIZARD_FIELD.depCol,
        `Binary logistic regression requires exactly 2 outcome categories (${k} found in the dataset preview).`
      );
    }
  }

  if (op === 'chi_square' && form.chiA?.trim() && form.chiB?.trim()) {
    const minE = minExpectedChiSquare(preview, form.chiA, form.chiB);
    if (minE != null && minE < 1) {
      pushError(
        errors,
        WIZARD_FIELD.chiB,
        `Contingency table is too sparse for chi-square (smallest expected count ≈ ${minE.toFixed(1)} in the preview).`
      );
    }
  }

  if (op === 'mcnemar') {
    for (const field of [WIZARD_FIELD.chiA, WIZARD_FIELD.chiB] as const) {
      const col = field === WIZARD_FIELD.chiA ? form.chiA : form.chiB;
      if (!col?.trim()) continue;
      checkColumnSlot(errors, field, schema, col, 'categorical');
      const slot = columnSlotType(schema, col);
      const k = countPreviewDistinctNonEmpty(preview, col);
      if (slot === 'numeric') {
        pushError(
          errors,
          field,
          `McNemar requires binary columns (exactly 2 categories). ${col} is continuous — convert to binary first.`
        );
      } else if (k != null && k > 2) {
        pushError(
          errors,
          field,
          `McNemar requires binary columns (exactly 2 categories). ${col} has ${k} categories — convert to binary first.`
        );
      }
    }
  }
}

function slotMismatchMessage(
  expected: ColumnSlotType,
  actual: ColumnSlotType,
  name: string
): string {
  return `This slot expects a ${expected} column. "${name}" is ${actual}.`;
}

function checkColumnSlot(
  errors: WizardFieldErrorsMap,
  field: WizardFieldId,
  schema: SchemaColumn[],
  name: string,
  expected: ColumnSlotType
) {
  if (!name) return;
  const actual = columnSlotType(schema, name);
  if (!slotTypeMatchesExpected(actual, expected)) {
    pushError(errors, field, slotMismatchMessage(expected, actual, name));
  }
}

export function computeWizardFieldNotices(
  op: AnalysisKey,
  form: AnalysisFormState,
  schema: SchemaColumn[],
  preview: DatasetPreview | null
): WizardFieldNoticesMap {
  const notices: WizardFieldNoticesMap = {};
  const numericNames = new Set(
    schema.filter(c => columnSlotType(schema, c.name) === 'numeric').map(c => c.name)
  );

  if (op === 'correlation') {
    const cols = form.selectedCols;
    if (!cols.length) {
      if (numericNames.size < 2) {
        pushNotice(notices, WIZARD_FIELD.columns, {
          level: 'warning',
          message: 'Fewer than two numeric columns in this dataset.',
          remedy: 'Add numeric variables or select columns explicitly.',
        });
      }
    } else {
      const nonNum = cols.filter(c => !numericNames.has(c));
      if (nonNum.length) {
        pushNotice(notices, WIZARD_FIELD.columns, {
          level: 'warning',
          message: `Non-numeric columns will be ignored: ${nonNum.join(', ')}.`,
        });
      }
      const numPicked = cols.filter(c => numericNames.has(c));
      if (numPicked.length < 2) {
        pushNotice(notices, WIZARD_FIELD.columns, {
          level: 'warning',
          message: 'Fewer than two numeric columns selected.',
          remedy: 'Pick at least two numeric variables for correlation.',
        });
      }
    }
  }

  if (op === 'linear_regression' || op === 'logistic_regression') {
    const inds = form.independentCols;
    if (inds.includes(form.depCol)) {
      pushNotice(notices, WIZARD_FIELD.independentCols, {
        level: 'warning',
        message: 'The dependent variable appears among predictors.',
        remedy: 'Remove the outcome from the predictor list.',
      });
    }
    const nonNumPred = inds.filter(c => schema.some(s => s.name === c) && !numericNames.has(c));
    if (nonNumPred.length && op === 'linear_regression') {
      pushNotice(notices, WIZARD_FIELD.independentCols, {
        level: 'warning',
        message: `These columns may need dummy coding before use as predictors: ${nonNumPred.join(', ')}.`,
      });
    }
  }

  if (op === 'logistic_regression' && preview?.rows.length) {
    const vals = columnStrings(preview, form.depCol);
    const k = new Set(vals).size;
    if (k > 2) {
      pushNotice(notices, WIZARD_FIELD.depCol, {
        level: 'warning',
        message: `Binary logistic regression requires a binary outcome. This column has ${k} distinct values in the preview.`,
        remedy: 'Recode the outcome to two categories or use a 0/1 numeric column.',
      });
    }
  }

  if (op === 'ordinal_regression' && preview?.rows.length && form.depCol.trim()) {
    const vals = columnStrings(preview, form.depCol);
    const k = new Set(vals).size;
    if (k > 10) {
      pushNotice(notices, WIZARD_FIELD.depCol, {
        level: 'warning',
        message: `${form.depCol} has many unique values — ordinal regression works best with a small number of ordered categories.`,
        remedy:
          'Recode the outcome into a small set of ordered categories before running ordinal regression.',
      });
    }
  }

  if (
    op === 'ttest_independent' ||
    op === 'mann_whitney_u' ||
    op === 'anova_oneway' ||
    op === 'kruskal_wallis'
  ) {
    if (preview?.rows.length) {
      const vals = columnStrings(preview, form.groupCol);
      const cc = counts(vals);
      const k = cc.size;
      if ((op === 'ttest_independent' || op === 'mann_whitney_u') && k !== 2) {
        if (!preview?.rows.length) {
          pushNotice(notices, WIZARD_FIELD.groupCol, {
            level: 'warning',
            message: 'This test requires exactly 2 groups in the grouping variable.',
            remedy: 'Select a variable with two categories, or recode/filter your data.',
          });
        }
      }
      if (op === 'anova_oneway' || op === 'kruskal_wallis') {
        if (k > 50) {
          pushNotice(notices, WIZARD_FIELD.groupCol, {
            level: 'warning',
            message: `Too many groups (${k}) for post-hoc testing in the preview.`,
            remedy: 'Consider a coarser grouping variable such as team or position.',
          });
        } else if (k > 20) {
          pushNotice(notices, WIZARD_FIELD.groupCol, {
            level: 'warning',
            message: `This variable has ${k} distinct groups. Plots and tables may be hard to read.`,
            remedy: 'Consider a coarser grouping variable.',
          });
        }
      }
      if (op === 'anova_oneway') {
        const tiny = [...cc.entries()].filter(([, n]) => n < 2);
        if (tiny.length) {
          const [g, n] = tiny[0]!;
          pushNotice(notices, WIZARD_FIELD.groupCol, {
            level: 'warning',
            message: `Group "${g}" has only ${n} case(s) in the preview.`,
            remedy: 'This group cannot contribute to variance estimation.',
          });
        }
        const small = [...cc.entries()].filter(([, n]) => n < 5);
        if (small.length && k <= 40) {
          const sample = small.slice(0, 3).map(([g, n]) => `"${g}" (${n})`);
          pushNotice(notices, WIZARD_FIELD.groupCol, {
            level: 'warning',
            message: `${small.length} group(s) have fewer than 5 observations in the preview.`,
            remedy: `${sample.join(', ')}${small.length > 3 ? ', …' : ''}. Interpret with caution.`,
          });
        }
        if (form.anovaPostHoc === 'tukey' && k > 50) {
          pushNotice(notices, WIZARD_FIELD.anovaPostHoc, {
            level: 'warning',
            message: 'Tukey HSD is unavailable when there are more than 50 groups.',
            remedy: 'Choose None for post-hoc or use a coarser factor.',
          });
        }
      }
      if (op === 'kruskal_wallis' && k < 2) {
        pushNotice(notices, WIZARD_FIELD.groupCol, {
          level: 'warning',
          message: 'Need at least two groups in the preview.',
        });
      }
      if (op === 'ttest_independent' || op === 'mann_whitney_u') {
        for (const [g, n] of cc) {
          if (n < 20) {
            pushNotice(notices, WIZARD_FIELD.groupCol, {
              level: 'warning',
              message: `Group "${g}" has only ${n} cases in the preview.`,
              remedy: 'Normality is harder to verify with small groups.',
            });
            break;
          }
        }
      }
      for (const [, n] of cc) {
        if (n < 30 && (op === 'anova_oneway' || op === 'kruskal_wallis')) {
          pushNotice(notices, WIZARD_FIELD.groupCol, {
            level: 'warning',
            message: 'Fewer than 30 cases in at least one group in the preview.',
            remedy: 'Interpret group comparisons with caution.',
          });
          break;
        }
      }
    }
    const opKey = String(op);
    const outcomeCol =
      opKey === 'ttest_one_sample'
        ? form.oneSampleCol
        : opKey === 'ttest_paired'
          ? form.pairedBeforeCol
          : form.valueCol;
    if (outcomeCol && preview?.rows.length) {
      const variance = previewColumnVariance(preview, outcomeCol);
      if (variance != null && variance < 1e-10) {
        pushNotice(notices, WIZARD_FIELD.valueCol, {
          level: 'warning',
          message: 'This column has near-zero variance in the preview.',
          remedy: 'Results may be unreliable.',
        });
      }
      const missingPct = previewColumnMissingPct(preview, outcomeCol);
      if (missingPct != null && missingPct > 0.5) {
        pushNotice(notices, WIZARD_FIELD.valueCol, {
          level: 'warning',
          message: `More than half of preview rows are missing for "${outcomeCol}".`,
          remedy: 'Check data quality before running the analysis.',
        });
      }
    }
  }

  if (op === 'ttest_one_sample' && preview?.rows.length) {
    const n = previewColumnNonMissingCount(preview, form.oneSampleCol);
    if (n != null && n < 20) {
      pushNotice(notices, WIZARD_FIELD.oneSampleCol, {
        level: 'warning',
        message: `Small sample (n = ${n}) in the preview.`,
        remedy: 'The t-test assumes normality, which is harder to verify with few cases.',
      });
    }
  }

  if (
    op === 'ttest_paired' &&
    preview?.rows.length &&
    form.pairedBeforeCol &&
    form.pairedAfterCol
  ) {
    const n1 = previewColumnNonMissingCount(preview, form.pairedBeforeCol);
    const n2 = previewColumnNonMissingCount(preview, form.pairedAfterCol);
    if (n1 != null && n2 != null && n1 !== n2) {
      pushNotice(notices, WIZARD_FIELD.pairedVar2, {
        level: 'warning',
        message: `These columns have different case counts (${n1} vs ${n2}) in the preview.`,
        remedy: 'Only cases with valid values in both columns will be analysed.',
      });
    }
  }

  if (op === 'correlation') {
    const cols = form.selectedCols.length ? form.selectedCols : numericNames;
    for (const c of cols) {
      if (!numericNames.has(c)) {
        pushNotice(notices, WIZARD_FIELD.columns, {
          level: 'warning',
          message: `Pearson correlation requires numeric variables. "${c}" is not numeric.`,
        });
        break;
      }
    }
  }

  if (op === 'linear_regression' && preview?.rows.length) {
    const n = preview?.rows.length ?? 0;
    const p = form.independentCols.length;
    if (p > 0 && n > 0 && p > n / 10) {
      pushNotice(notices, WIZARD_FIELD.independentCols, {
        level: 'warning',
        message: `You have ${p} predictors for ${n} preview rows.`,
        remedy: 'As a rule of thumb, linear regression needs at least 10 cases per predictor.',
      });
    }
  }

  if (
    op === 'ttest_paired' &&
    form.pairedBeforeCol &&
    form.pairedAfterCol &&
    form.pairedBeforeCol === form.pairedAfterCol
  ) {
    pushNotice(notices, WIZARD_FIELD.pairedVar2, {
      level: 'warning',
      message: 'Variable 1 and Variable 2 must be different columns.',
    });
  }

  if (op === 'chi_square') {
    if (preview?.rows.length) {
      const minE = minExpectedChiSquare(preview, form.chiA, form.chiB);
      if (minE != null && minE < 5) {
        pushNotice(notices, WIZARD_FIELD.chiB, {
          level: 'warning',
          message: `Sparse contingency table in preview (smallest expected count ≈ ${minE.toFixed(1)}).`,
          remedy:
            'Chi-square asymptotics may be unreliable; collect more data or collapse categories.',
        });
      }
    }
  }

  return notices;
}

export function computeWizardFieldErrors(
  op: AnalysisKey,
  form: AnalysisFormState,
  schema: SchemaColumn[],
  preview: DatasetPreview | null = null
): WizardFieldErrorsMap {
  const errors: WizardFieldErrorsMap = {};
  appendRequiredFieldErrors(op, form, schema, errors);
  const numericNames = schema
    .filter(c => columnSlotType(schema, c.name) === 'numeric')
    .map(c => c.name);

  switch (op) {
    case 'descriptives':
      break;
    case 'correlation':
      break;
    case 'ttest_independent':
    case 'mann_whitney_u':
    case 'anova_oneway':
    case 'kruskal_wallis':
      if (form.groupCol)
        checkColumnSlot(errors, WIZARD_FIELD.groupCol, schema, form.groupCol, 'categorical');
      if (form.valueCol)
        checkColumnSlot(errors, WIZARD_FIELD.valueCol, schema, form.valueCol, 'numeric');
      if (
        op === 'ttest_independent' &&
        form.hypothesizedDifference.trim() !== '' &&
        Number.isNaN(Number(form.hypothesizedDifference))
      ) {
        pushError(
          errors,
          WIZARD_FIELD.hypothesizedDifference,
          'Enter a valid hypothesised difference.'
        );
      }
      break;
    case 'ttest_paired':
    case 'wilcoxon_signed_rank':
      checkColumnSlot(errors, WIZARD_FIELD.pairedVar1, schema, form.pairedBeforeCol, 'numeric');
      checkColumnSlot(errors, WIZARD_FIELD.pairedVar2, schema, form.pairedAfterCol, 'numeric');
      if (
        form.pairedBeforeCol &&
        form.pairedAfterCol &&
        form.pairedBeforeCol === form.pairedAfterCol
      ) {
        pushError(
          errors,
          WIZARD_FIELD.pairedVar2,
          'Variable 1 and Variable 2 must be different columns.'
        );
      }
      break;
    case 'friedman':
      break;
    case 'reliability_cronbach':
      break;
    case 'kolmogorov_smirnov':
      checkColumnSlot(errors, WIZARD_FIELD.pairedVar1, schema, form.pairedBeforeCol, 'numeric');
      if (form.ksTestType === 'two_sample') {
        checkColumnSlot(errors, WIZARD_FIELD.pairedVar2, schema, form.pairedAfterCol, 'numeric');
        if (
          form.pairedBeforeCol &&
          form.pairedAfterCol &&
          form.pairedBeforeCol === form.pairedAfterCol
        ) {
          pushError(errors, WIZARD_FIELD.pairedVar2, 'Samples must be different columns.');
        }
      }
      break;
    case 'ttest_one_sample':
      checkColumnSlot(errors, WIZARD_FIELD.oneSampleCol, schema, form.oneSampleCol, 'numeric');
      break;
    case 'linear_regression':
      if (form.depCol) checkColumnSlot(errors, WIZARD_FIELD.depCol, schema, form.depCol, 'numeric');
      if (form.independentCols.includes(form.depCol)) {
        pushError(
          errors,
          WIZARD_FIELD.independentCols,
          'Predictors must not include the dependent variable.'
        );
      }
      break;
    case 'logistic_regression':
      if (form.independentCols.includes(form.depCol)) {
        pushError(
          errors,
          WIZARD_FIELD.independentCols,
          'Predictors must not include the dependent variable.'
        );
      }
      const cutoff = Number(form.logisticCutoff);
      if (
        form.logisticCutoff.trim() === '' ||
        Number.isNaN(cutoff) ||
        cutoff < 0.01 ||
        cutoff > 0.99
      ) {
        pushError(
          errors,
          WIZARD_FIELD.logisticCutoff,
          'Classification cutoff must be between 0.01 and 0.99.'
        );
      }
      const iters = Number(form.logisticMaxIterations);
      if (form.logisticMaxIterations.trim() === '' || Number.isNaN(iters) || iters < 1) {
        pushError(
          errors,
          WIZARD_FIELD.logisticMaxIterations,
          'Maximum iterations must be at least 1.'
        );
      }
      break;
    case 'chi_square':
    case 'fishers_exact':
    case 'odds_ratio':
    case 'relative_risk':
    case 'goodman_kruskal_gamma':
    case 'somers_d':
    case 'goodman_kruskal_lambda':
    case 'weighted_kappa':
      if (form.chiA && form.chiB && form.chiA === form.chiB) {
        pushError(errors, WIZARD_FIELD.chiB, 'Variables must be different.');
      }
      break;
    case 'cohens_kappa':
      if (form.chiA && form.chiB && form.chiA === form.chiB) {
        pushError(errors, WIZARD_FIELD.chiB, 'Variables must be different.');
      }
      for (const [field, col] of [
        [WIZARD_FIELD.chiA, form.chiA],
        [WIZARD_FIELD.chiB, form.chiB],
      ] as const) {
        if (!col?.trim()) continue;
        checkColumnSlot(errors, field, schema, col, 'categorical');
        const slot = columnSlotType(schema, col);
        const nUnique = countPreviewDistinctNonEmpty(preview, col);
        if (slot === 'numeric' || (nUnique != null && nUnique > 20)) {
          pushError(
            errors,
            field,
            "Cohen's Kappa requires categorical columns. These columns appear to be numeric — convert to categories first or select different columns."
          );
        }
      }
      break;
    case 'mcnemar':
      if (form.chiA && form.chiB && form.chiA === form.chiB) {
        pushError(errors, WIZARD_FIELD.chiB, 'Variables must be different.');
      }
      break;
    case 'partial_correlation':
      checkColumnSlot(errors, WIZARD_FIELD.pairedVar1, schema, form.pairedBeforeCol, 'numeric');
      checkColumnSlot(errors, WIZARD_FIELD.pairedVar2, schema, form.pairedAfterCol, 'numeric');
      if (form.pairedBeforeCol === form.pairedAfterCol) {
        pushError(errors, WIZARD_FIELD.pairedVar2, 'X and Y must be different columns.');
      }
      break;
    case 'pca':
      break;
    case 'efa':
      break;
    case 'cluster_analysis': {
      const k = Number(form.pcaNComponents || '3');
      if (Number.isNaN(k) || k < 2) {
        pushError(errors, WIZARD_FIELD.columns, 'Number of clusters must be at least 2.');
      }
      break;
    }
    case 'discriminant_analysis':
      if (form.groupCol)
        checkColumnSlot(errors, WIZARD_FIELD.groupCol, schema, form.groupCol, 'categorical');
      break;
    case 'manova':
      if (form.groupCol)
        checkColumnSlot(errors, WIZARD_FIELD.groupCol, schema, form.groupCol, 'categorical');
      break;
    case 'ancova':
      if (form.groupCol)
        checkColumnSlot(errors, WIZARD_FIELD.groupCol, schema, form.groupCol, 'categorical');
      if (form.valueCol)
        checkColumnSlot(errors, WIZARD_FIELD.valueCol, schema, form.valueCol, 'numeric');
      if (form.covariateCol)
        checkColumnSlot(errors, WIZARD_FIELD.depCol, schema, form.covariateCol, 'numeric');
      if (form.valueCol && form.covariateCol && form.valueCol === form.covariateCol) {
        pushError(errors, WIZARD_FIELD.depCol, 'Outcome and covariate must differ.');
      }
      break;
    case 'decision_tree':
      if (form.depCol)
        checkColumnSlot(errors, WIZARD_FIELD.depCol, schema, form.depCol, 'categorical');
      break;
    case 'random_forest_classification':
    case 'svm_classification':
      if (form.depCol)
        checkColumnSlot(errors, WIZARD_FIELD.depCol, schema, form.depCol, 'categorical');
      break;
    case 'random_forest_regression':
      if (form.depCol) checkColumnSlot(errors, WIZARD_FIELD.depCol, schema, form.depCol, 'numeric');
      break;
    case 'gradient_boosting':
    case 'neural_network_mlp':
      if (form.depCol) {
        checkColumnSlot(
          errors,
          WIZARD_FIELD.depCol,
          schema,
          form.depCol,
          form.mlMode === 'regression' ? 'numeric' : 'categorical'
        );
      }
      break;
    case 'dbscan':
      break;
    case 'arima_sarima':
    case 'exponential_smoothing':
    case 'stl_decomposition':
    case 'stationarity_tests':
    case 'autocorrelation':
      if (form.valueCol)
        checkColumnSlot(errors, WIZARD_FIELD.valueCol, schema, form.valueCol, 'numeric');
      break;
    case 'kaplan_meier':
    case 'cox_proportional_hazards':
    case 'nelson_aalen':
      if (form.durationCol)
        checkColumnSlot(errors, WIZARD_FIELD.durationCol, schema, form.durationCol, 'numeric');
      if (form.eventCol)
        checkColumnSlot(errors, WIZARD_FIELD.eventCol, schema, form.eventCol, 'numeric');
      if (form.durationCol && form.eventCol && form.durationCol === form.eventCol) {
        pushError(errors, WIZARD_FIELD.eventCol, 'Duration and event columns must differ.');
      }
      break;
    case 'anova_twoway':
      if (form.groupCol)
        checkColumnSlot(errors, WIZARD_FIELD.groupCol, schema, form.groupCol, 'categorical');
      if (form.factorBCol)
        checkColumnSlot(errors, WIZARD_FIELD.valueCol, schema, form.factorBCol, 'categorical');
      if (form.valueCol)
        checkColumnSlot(errors, WIZARD_FIELD.depCol, schema, form.valueCol, 'numeric');
      if (form.groupCol && form.factorBCol && form.groupCol === form.factorBCol) {
        pushError(errors, WIZARD_FIELD.valueCol, 'Factor A and Factor B must differ.');
      }
      break;
    case 'anova_repeated':
      if (form.subjectCol)
        checkColumnSlot(errors, WIZARD_FIELD.groupCol, schema, form.subjectCol, 'categorical');
      break;
    case 'poisson_regression':
      if (form.depCol) checkColumnSlot(errors, WIZARD_FIELD.depCol, schema, form.depCol, 'numeric');
      break;
    case 'linear_mixed_model':
      if (form.depCol) checkColumnSlot(errors, WIZARD_FIELD.depCol, schema, form.depCol, 'numeric');
      if (form.groupCol)
        checkColumnSlot(errors, WIZARD_FIELD.groupCol, schema, form.groupCol, 'categorical');
      break;
    case 'generalized_linear_mixed_model':
      if (form.groupCol)
        checkColumnSlot(errors, WIZARD_FIELD.groupCol, schema, form.groupCol, 'categorical');
      if (form.depCol) {
        checkColumnSlot(
          errors,
          WIZARD_FIELD.depCol,
          schema,
          form.depCol,
          form.glmmFamily === 'poisson' ? 'numeric' : 'categorical'
        );
      }
      break;
    case 'multilevel_modelling':
      if (form.valueCol)
        checkColumnSlot(errors, WIZARD_FIELD.valueCol, schema, form.valueCol, 'numeric');
      if (form.groupCol)
        checkColumnSlot(errors, WIZARD_FIELD.groupCol, schema, form.groupCol, 'categorical');
      break;
    case 'latent_class_analysis':
      break;
    case 'confirmatory_factor_analysis':
      break;
    case 'structural_equation_modelling':
      break;
    default:
      break;
  }

  appendPreviewBlockingErrors(op, form, preview, errors, schema);

  return errors;
}

export function hasWizardBlockingErrors(errors: WizardFieldErrorsMap): boolean {
  return Object.values(errors).some(list => list && list.length > 0);
}

export function analysisRequiredFieldsSatisfied(
  op: AnalysisKey,
  form: AnalysisFormState,
  schema: SchemaColumn[]
): boolean {
  const numericNames = schema
    .filter(c => columnSlotType(schema, c.name) === 'numeric')
    .map(c => c.name);
  switch (op) {
    case 'descriptives':
      return true;
    case 'correlation': {
      if (form.selectedCols.length) {
        return form.selectedCols.filter(c => numericNames.includes(c)).length >= 2;
      }
      return numericNames.length >= 2;
    }
    case 'ttest_independent':
    case 'mann_whitney_u':
    case 'anova_oneway':
    case 'kruskal_wallis':
      return !!(form.groupCol?.trim() && form.valueCol?.trim());
    case 'ttest_paired':
    case 'wilcoxon_signed_rank':
      return !!(
        form.pairedBeforeCol?.trim() &&
        form.pairedAfterCol?.trim() &&
        form.pairedBeforeCol !== form.pairedAfterCol
      );
    case 'friedman':
      return form.selectedCols.filter(c => numericNames.includes(c)).length >= 3;
    case 'reliability_cronbach':
      return form.selectedCols.filter(c => numericNames.includes(c)).length >= 2;
    case 'kolmogorov_smirnov':
      if (form.ksTestType === 'normality') return !!form.pairedBeforeCol?.trim();
      return !!(
        form.pairedBeforeCol?.trim() &&
        form.pairedAfterCol?.trim() &&
        form.pairedBeforeCol !== form.pairedAfterCol
      );
    case 'ttest_one_sample':
      return !!(
        form.oneSampleCol?.trim() &&
        form.hypothesizedMean.trim() !== '' &&
        !Number.isNaN(Number(form.hypothesizedMean))
      );
    case 'linear_regression':
    case 'logistic_regression':
      return !!(form.depCol?.trim() && form.independentCols.length > 0);
    case 'chi_square':
    case 'cohens_kappa':
      return !!(form.chiA?.trim() && form.chiB?.trim() && form.chiA !== form.chiB);
    case 'partial_correlation':
      return !!(
        form.pairedBeforeCol?.trim() &&
        form.pairedAfterCol?.trim() &&
        form.pairedBeforeCol !== form.pairedAfterCol
      );
    case 'pca':
      return form.selectedCols.filter(c => numericNames.includes(c)).length >= 2;
    case 'efa':
      return form.selectedCols.filter(c => numericNames.includes(c)).length >= 2;
    case 'cluster_analysis':
      return form.selectedCols.filter(c => numericNames.includes(c)).length >= 1;
    case 'discriminant_analysis':
      return !!(
        form.groupCol?.trim() && form.selectedCols.filter(c => numericNames.includes(c)).length >= 1
      );
    case 'manova':
      return !!(
        form.groupCol?.trim() && form.selectedCols.filter(c => numericNames.includes(c)).length >= 2
      );
    case 'ancova':
      return !!(
        form.groupCol?.trim() &&
        form.valueCol?.trim() &&
        form.covariateCol?.trim() &&
        form.valueCol !== form.covariateCol
      );
    case 'decision_tree':
      return !!(form.depCol?.trim() && form.independentCols.length > 0);
    case 'random_forest_classification':
    case 'svm_classification':
      return !!(form.depCol?.trim() && form.independentCols.length > 0);
    case 'random_forest_regression':
      return !!(form.depCol?.trim() && form.independentCols.length > 0);
    case 'gradient_boosting':
    case 'neural_network_mlp':
      return !!(form.depCol?.trim() && form.independentCols.length > 0);
    case 'dbscan':
      return form.selectedCols.filter(c => numericNames.includes(c)).length >= 1;
    case 'arima_sarima':
    case 'exponential_smoothing':
    case 'stl_decomposition':
    case 'stationarity_tests':
    case 'autocorrelation':
      return !!form.valueCol?.trim();
    case 'kaplan_meier':
    case 'nelson_aalen':
      return !!(
        form.durationCol?.trim() &&
        form.eventCol?.trim() &&
        form.durationCol !== form.eventCol
      );
    case 'cox_proportional_hazards':
      return !!(
        form.durationCol?.trim() &&
        form.eventCol?.trim() &&
        form.durationCol !== form.eventCol &&
        form.independentCols.length > 0
      );
    case 'anova_twoway':
      return !!(
        form.groupCol?.trim() &&
        form.factorBCol?.trim() &&
        form.valueCol?.trim() &&
        form.groupCol !== form.factorBCol
      );
    case 'anova_repeated':
      return !!(
        form.subjectCol?.trim() &&
        form.selectedCols.filter(c => numericNames.includes(c)).length >= 2
      );
    case 'stepwise_regression':
    case 'poisson_regression':
      return !!(form.depCol?.trim() && form.independentCols.length > 0);
    case 'linear_mixed_model':
      return !!(form.depCol?.trim() && form.groupCol?.trim() && form.independentCols.length > 0);
    case 'generalized_linear_mixed_model':
      return !!(form.depCol?.trim() && form.groupCol?.trim() && form.independentCols.length > 0);
    case 'multilevel_modelling':
      return !!(form.valueCol?.trim() && form.groupCol?.trim() && form.independentCols.length > 0);
    case 'latent_class_analysis':
      return form.selectedCols.length >= 1 && (Number(form.pcaNComponents) || 2) >= 2;
    case 'confirmatory_factor_analysis':
      return (
        form.selectedCols.filter(c => numericNames.includes(c)).length >= 2 &&
        !!form.semModelSpec.trim()
      );
    case 'structural_equation_modelling':
      return !!form.semModelSpec.trim();
    default:
      return false;
  }
}

export function getAnalysisRunBlockers(
  op: AnalysisKey,
  form: AnalysisFormState,
  schema: SchemaColumn[],
  datasetId: string | null,
  preview: DatasetPreview | null = null
): string[] {
  if (!datasetId) return ['No dataset selected.'];
  if (!schema.length) return ['Dataset schema is not loaded yet.'];

  const errors = computeWizardFieldErrors(op, form, schema, preview);
  const messages: string[] = [];
  for (const list of Object.values(errors)) {
    if (list?.length) messages.push(...list);
  }

  if (!messages.length && !analysisRequiredFieldsSatisfied(op, form, schema)) {
    messages.push('Complete the required fields above.');
  }

  return messages;
}

export function canRunAnalysis(
  op: AnalysisKey,
  form: AnalysisFormState,
  schema: SchemaColumn[],
  datasetId: string | null,
  preview: DatasetPreview | null = null
): boolean {
  return getAnalysisRunBlockers(op, form, schema, datasetId, preview).length === 0;
}

function previewColumnNonMissingCount(preview: DatasetPreview, col: string): number | null {
  const idx = preview.headers.indexOf(col);
  if (idx < 0) return null;
  let n = 0;
  for (const row of preview.rows) {
    const v = row[idx];
    if (v != null && v !== '') n += 1;
  }
  return n;
}

function previewColumnMissingPct(preview: DatasetPreview, col: string): number | null {
  const idx = preview.headers.indexOf(col);
  if (idx < 0 || !preview.rows.length) return null;
  let missing = 0;
  for (const row of preview.rows) {
    const v = row[idx];
    if (v == null || v === '') missing += 1;
  }
  return missing / preview.rows.length;
}

function previewColumnVariance(preview: DatasetPreview, col: string): number | null {
  const idx = preview.headers.indexOf(col);
  if (idx < 0) return null;
  const nums: number[] = [];
  for (const row of preview.rows) {
    const v = row[idx];
    if (v == null || v === '') continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) nums.push(n);
  }
  if (nums.length < 2) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (nums.length - 1);
}

/** Distinct non-empty values for a column in the loaded preview (session rows only). */
export function countPreviewDistinctNonEmpty(
  preview: DatasetPreview | null,
  columnName: string
): number | null {
  if (!preview?.rows.length) return null;
  const idx = preview.headers.indexOf(columnName);
  if (idx < 0) return null;
  const seen = new Set<string>();
  for (const row of preview.rows) {
    const v = row[idx];
    if (v != null && v !== '') seen.add(String(v));
  }
  return seen.size;
}

/** @deprecated Use computeWizardFieldNotices — returns flat list for legacy callers. */
export type WizardNotice = {
  level: 'warning' | 'info';
  title: string;
  detail?: string;
};

/** @deprecated */
export function computeWizardNotices(
  op: AnalysisKey,
  form: AnalysisFormState,
  schema: SchemaColumn[],
  preview: DatasetPreview | null
): WizardNotice[] {
  const map = computeWizardFieldNotices(op, form, schema, preview);
  const flat: WizardNotice[] = [];
  for (const list of Object.values(map)) {
    if (!list) continue;
    for (const n of list) {
      flat.push({ level: 'warning', title: n.message, detail: n.remedy });
    }
  }
  return flat;
}

export { typeBadgeLabel } from '@/lib/analysis-column-types';
