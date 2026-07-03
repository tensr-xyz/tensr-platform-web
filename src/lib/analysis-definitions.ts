import type { AnalysisReport, SchemaColumn } from '@/lib/analysis-report-types';

export type AnalysisKey =
  | 'descriptives'
  | 'correlation'
  | 'ttest_independent'
  | 'ttest_paired'
  | 'ttest_one_sample'
  | 'anova_oneway'
  | 'mann_whitney_u'
  | 'kruskal_wallis'
  | 'wilcoxon_signed_rank'
  | 'friedman'
  | 'kolmogorov_smirnov'
  | 'reliability_cronbach'
  | 'partial_correlation'
  | 'pca'
  | 'anova_twoway'
  | 'anova_repeated'
  | 'stepwise_regression'
  | 'poisson_regression'
  | 'cohens_kappa'
  | 'efa'
  | 'discriminant_analysis'
  | 'cluster_analysis'
  | 'manova'
  | 'ancova'
  | 'decision_tree'
  | 'linear_regression'
  | 'logistic_regression'
  | 'chi_square'
  | 'shapiro_wilk'
  | 'sign_test'
  | 'probit_regression'
  | 'mcnemar'
  | 'negative_binomial_regression'
  | 'ordinal_regression'
  | 'median_test'
  | 'runs_test'
  | 'jonckheere_terpstra'
  | 'moses_test'
  | 'cochrans_q'
  | 'canonical_correlation'
  | 'multidimensional_scaling'
  | 'hotelling_t2'
  | 'lilliefors_ks'
  | 'random_forest_classification'
  | 'random_forest_regression'
  | 'svm_classification'
  | 'gradient_boosting'
  | 'neural_network_mlp'
  | 'dbscan'
  | 'arima_sarima'
  | 'exponential_smoothing'
  | 'stl_decomposition'
  | 'stationarity_tests'
  | 'autocorrelation'
  | 'kaplan_meier'
  | 'cox_proportional_hazards'
  | 'nelson_aalen'
  | 'linear_mixed_model'
  | 'generalized_linear_mixed_model'
  | 'multilevel_modelling'
  | 'latent_class_analysis'
  | 'confirmatory_factor_analysis'
  | 'structural_equation_modelling'
  | 'fleiss_kappa'
  | 'weighted_kappa'
  | 'kendalls_w'
  | 'fishers_exact'
  | 'odds_ratio'
  | 'relative_risk'
  | 'goodman_kruskal_gamma'
  | 'somers_d'
  | 'goodman_kruskal_lambda'
  | 'mantel_haenszel'
  | 'cochran_armitage'
  | 'loglinear'
  | 'hierarchical_regression'
  | 'anova_mixed'
  | 'anova_threeway'
  | 'moderation_analysis';

export type KolmogorovTestType = 'normality' | 'two_sample';

export const ANALYSIS_LABELS: Record<AnalysisKey, string> = {
  descriptives: 'Frequencies',
  correlation: 'Bivariate Correlations',
  ttest_independent: 'Independent-Samples T Test',
  ttest_paired: 'Paired-Samples T Test',
  ttest_one_sample: 'One-Sample T Test',
  anova_oneway: 'One-Way ANOVA',
  mann_whitney_u: 'Mann-Whitney U',
  kruskal_wallis: 'Kruskal-Wallis H',
  wilcoxon_signed_rank: 'Wilcoxon Signed-Rank',
  friedman: 'Friedman Test',
  kolmogorov_smirnov: 'Kolmogorov-Smirnov',
  reliability_cronbach: 'Reliability Analysis',
  partial_correlation: 'Partial Correlation',
  pca: 'Principal Component Analysis',
  anova_twoway: 'Two-Way ANOVA',
  anova_repeated: 'Repeated Measures ANOVA',
  stepwise_regression: 'Stepwise Regression',
  poisson_regression: 'Poisson Regression',
  cohens_kappa: "Cohen's Kappa",
  efa: 'Exploratory Factor Analysis',
  discriminant_analysis: 'Discriminant Analysis',
  cluster_analysis: 'Cluster Analysis',
  manova: 'Multivariate ANOVA',
  ancova: 'ANCOVA',
  decision_tree: 'Decision Tree Classification',
  linear_regression: 'Linear Regression',
  logistic_regression: 'Binary Logistic Regression',
  chi_square: 'Crosstabs',
  shapiro_wilk: 'Shapiro–Wilk Test',
  sign_test: 'Sign Test',
  probit_regression: 'Probit Regression',
  mcnemar: 'McNemar Test',
  negative_binomial_regression: 'Negative Binomial Regression',
  ordinal_regression: 'Ordinal Regression',
  median_test: 'Median Test',
  runs_test: 'Runs Test',
  jonckheere_terpstra: 'Jonckheere–Terpstra',
  moses_test: 'Moses Test',
  cochrans_q: "Cochran's Q",
  canonical_correlation: 'Canonical Correlation',
  multidimensional_scaling: 'Multidimensional Scaling (MDS)',
  hotelling_t2: "Hotelling's T²",
  lilliefors_ks: 'Lilliefors K–S',
  random_forest_classification: 'Random Forest Classification',
  random_forest_regression: 'Random Forest Regression',
  svm_classification: 'Support Vector Machine Classification',
  gradient_boosting: 'Gradient Boosting',
  neural_network_mlp: 'Neural Network (MLP)',
  dbscan: 'DBSCAN Clustering',
  arima_sarima: 'ARIMA / SARIMA',
  exponential_smoothing: 'Exponential Smoothing (Holt-Winters)',
  stl_decomposition: 'Seasonal Decomposition (STL)',
  stationarity_tests: 'Stationarity Tests (ADF + KPSS)',
  autocorrelation: 'Autocorrelation (ACF / PACF)',
  kaplan_meier: 'Kaplan-Meier',
  cox_proportional_hazards: 'Cox Proportional Hazards',
  nelson_aalen: 'Nelson-Aalen Estimator',
  linear_mixed_model: 'Linear Mixed Model (LMM)',
  generalized_linear_mixed_model: 'Generalized Linear Mixed Model (GLMM)',
  multilevel_modelling: 'Multilevel Modelling (HLM)',
  latent_class_analysis: 'Latent Class Analysis (LCA)',
  confirmatory_factor_analysis: 'Confirmatory Factor Analysis (CFA)',
  structural_equation_modelling: 'Structural Equation Modelling (SEM)',
  fleiss_kappa: "Fleiss' Kappa",
  weighted_kappa: 'Weighted Kappa',
  kendalls_w: "Kendall's W",
  fishers_exact: "Fisher's Exact Test",
  odds_ratio: 'Odds Ratio',
  relative_risk: 'Relative Risk',
  goodman_kruskal_gamma: 'Goodman-Kruskal Gamma',
  somers_d: "Somers' D",
  goodman_kruskal_lambda: 'Goodman-Kruskal Lambda',
  mantel_haenszel: 'Mantel-Haenszel Trend Test',
  cochran_armitage: 'Cochran-Armitage Trend Test',
  loglinear: 'Loglinear Analysis',
  hierarchical_regression: 'Hierarchical Multiple Regression',
  anova_mixed: 'Mixed ANOVA',
  anova_threeway: 'Three-Way ANOVA',
  moderation_analysis: 'Moderation Analysis',
};

export const SPSS_MENU_PATHS: Record<AnalysisKey, string> = {
  descriptives: 'Analyze → Descriptive Statistics → Frequencies',
  correlation: 'Analyze → Correlate → Bivariate',
  ttest_independent: 'Analyze → Compare Means → Independent-Samples T Test',
  ttest_paired: 'Analyze → Compare Means → Paired-Samples T Test',
  ttest_one_sample: 'Analyze → Compare Means → One-Sample T Test',
  anova_oneway: 'Analyze → Compare Means → One-Way ANOVA',
  mann_whitney_u: 'Analyze → Nonparametric Tests → 2 Independent Samples',
  kruskal_wallis: 'Analyze → Nonparametric Tests → K Independent Samples',
  wilcoxon_signed_rank: 'Analyze → Nonparametric Tests → 2 Related Samples',
  friedman: 'Analyze → Nonparametric Tests → K Related Samples',
  kolmogorov_smirnov: 'Analyze → Nonparametric Tests → K-S',
  reliability_cronbach: 'Analyze → Scale → Reliability Analysis',
  partial_correlation: 'Analyze → Correlate → Partial',
  pca: 'Analyze → Dimension Reduction → PCA',
  anova_twoway: 'Analyze → General Linear Model → Univariate',
  anova_repeated: 'Analyze → General Linear Model → Repeated Measures',
  stepwise_regression: 'Analyze → Regression → Linear → Stepwise',
  poisson_regression: 'Analyze → Regression → Poisson',
  cohens_kappa: 'Analyze → Descriptive Statistics → Crosstabs → Kappa',
  efa: 'Analyze → Dimension Reduction → Factor',
  discriminant_analysis: 'Analyze → Classify → Discriminant',
  cluster_analysis: 'Analyze → Classify → Hierarchical Cluster',
  manova: 'Analyze → General Linear Model → Multivariate',
  ancova: 'Analyze → General Linear Model → Univariate',
  decision_tree: 'Analyze → Classify → Tree',
  linear_regression: 'Analyze → Regression → Linear',
  logistic_regression: 'Analyze → Regression → Binary Logistic',
  chi_square: 'Analyze → Descriptive Statistics → Crosstabs',
  shapiro_wilk: 'Analyze → Nonparametric Tests → Normality',
  sign_test: 'Analyze → Nonparametric Tests → Related Samples',
  probit_regression: 'Analyze → Regression → Probit',
  mcnemar: 'Analyze → Descriptive Statistics → Crosstabs',
  negative_binomial_regression: 'Analyze → Regression → Negative Binomial',
  ordinal_regression: 'Analyze → Regression → Ordinal',
  median_test: 'Analyze → Compare Means → Median Test',
  runs_test: 'Analyze → Nonparametric Tests → Runs',
  jonckheere_terpstra: 'Analyze → Nonparametric Tests → Jonckheere–Terpstra',
  moses_test: 'Analyze → Nonparametric Tests → Moses',
  cochrans_q: 'Analyze → Nonparametric Tests → Cochran',
  canonical_correlation: 'Analyze → Correlate → Canonical',
  multidimensional_scaling: 'Analyze → Scale → Multidimensional Scaling',
  hotelling_t2: 'Analyze → Compare Means → Hotelling',
  lilliefors_ks: 'Analyze → Nonparametric Tests → Normality',
  random_forest_classification: 'ML → Classification → Random Forest',
  random_forest_regression: 'ML → Regression → Random Forest',
  svm_classification: 'ML → Classification → SVM',
  gradient_boosting: 'ML → Gradient Boosting',
  neural_network_mlp: 'ML → Neural Network',
  dbscan: 'ML → Clustering → DBSCAN',
  arima_sarima: 'Time series → Forecasting → ARIMA / SARIMA',
  exponential_smoothing: 'Time series → Forecasting → Holt-Winters',
  stl_decomposition: 'Time series → Decomposition → STL',
  stationarity_tests: 'Time series → Diagnostics → Stationarity',
  autocorrelation: 'Time series → Diagnostics → ACF / PACF',
  kaplan_meier: 'Time series → Survival → Kaplan-Meier',
  cox_proportional_hazards: 'Time series → Survival → Cox PH',
  nelson_aalen: 'Time series → Survival → Nelson-Aalen',
  linear_mixed_model: 'Multivariate → Mixed Models → LMM',
  generalized_linear_mixed_model: 'Multivariate → Mixed Models → GLMM',
  multilevel_modelling: 'Multivariate → Mixed Models → HLM',
  latent_class_analysis: 'Multivariate → Latent Class Analysis',
  confirmatory_factor_analysis: 'Multivariate → CFA',
  structural_equation_modelling: 'Multivariate → SEM',
  fleiss_kappa: 'Analyze → Scale → Fleiss Kappa',
  weighted_kappa: 'Analyze → Scale → Weighted Kappa',
  kendalls_w: 'Analyze → Scale → Kendall W',
  fishers_exact: 'Analyze → Descriptive Statistics → Crosstabs → Exact',
  odds_ratio: 'Analyze → Descriptive Statistics → Odds Ratio',
  relative_risk: 'Analyze → Descriptive Statistics → Relative Risk',
  goodman_kruskal_gamma: 'Analyze → Correlate → Gamma',
  somers_d: 'Analyze → Correlate → Somers D',
  goodman_kruskal_lambda: 'Analyze → Correlate → Lambda',
  mantel_haenszel: 'Analyze → Correlate → Mantel-Haenszel Trend',
  cochran_armitage: 'Analyze → Correlate → Cochran-Armitage Trend',
  loglinear: 'Analyze → Loglinear → General',
  hierarchical_regression: 'Analyze → Regression → Linear → Hierarchical',
  anova_mixed: 'Analyze → General Linear Model → Mixed ANOVA',
  anova_threeway: 'Analyze → General Linear Model → Three-Way ANOVA',
  moderation_analysis: 'Analyze → Regression → Moderation',
};

/** Category ids for the command palette (display order). */
export const PALETTE_CATEGORY_ORDER = [
  'describe',
  'compare',
  'relationships',
  'prediction',
  'frequencies',
] as const;
export type PaletteCategoryId = (typeof PALETTE_CATEGORY_ORDER)[number];

export const PALETTE_CATEGORY_TITLES: Record<PaletteCategoryId, string> = {
  describe: 'Describe data',
  compare: 'Compare groups',
  relationships: 'Relationships',
  prediction: 'Prediction',
  frequencies: 'Frequencies',
};

export const ANALYSIS_PALETTE_CATEGORY: Record<AnalysisKey, PaletteCategoryId> = {
  descriptives: 'describe',
  ttest_independent: 'compare',
  ttest_paired: 'compare',
  ttest_one_sample: 'compare',
  anova_oneway: 'compare',
  mann_whitney_u: 'compare',
  kruskal_wallis: 'compare',
  wilcoxon_signed_rank: 'compare',
  friedman: 'compare',
  kolmogorov_smirnov: 'compare',
  reliability_cronbach: 'describe',
  partial_correlation: 'relationships',
  pca: 'describe',
  anova_twoway: 'compare',
  anova_repeated: 'compare',
  stepwise_regression: 'prediction',
  poisson_regression: 'prediction',
  cohens_kappa: 'frequencies',
  efa: 'describe',
  discriminant_analysis: 'compare',
  cluster_analysis: 'describe',
  manova: 'compare',
  ancova: 'compare',
  decision_tree: 'prediction',
  correlation: 'relationships',
  linear_regression: 'prediction',
  logistic_regression: 'prediction',
  chi_square: 'frequencies',
  shapiro_wilk: 'compare',
  sign_test: 'compare',
  probit_regression: 'prediction',
  mcnemar: 'frequencies',
  negative_binomial_regression: 'prediction',
  ordinal_regression: 'prediction',
  median_test: 'compare',
  runs_test: 'compare',
  jonckheere_terpstra: 'compare',
  moses_test: 'compare',
  cochrans_q: 'compare',
  canonical_correlation: 'relationships',
  multidimensional_scaling: 'describe',
  hotelling_t2: 'compare',
  lilliefors_ks: 'compare',
  random_forest_classification: 'prediction',
  random_forest_regression: 'prediction',
  svm_classification: 'prediction',
  gradient_boosting: 'prediction',
  neural_network_mlp: 'prediction',
  dbscan: 'describe',
  arima_sarima: 'prediction',
  exponential_smoothing: 'prediction',
  stl_decomposition: 'describe',
  stationarity_tests: 'describe',
  autocorrelation: 'describe',
  kaplan_meier: 'prediction',
  cox_proportional_hazards: 'prediction',
  nelson_aalen: 'prediction',
  linear_mixed_model: 'prediction',
  generalized_linear_mixed_model: 'prediction',
  multilevel_modelling: 'prediction',
  latent_class_analysis: 'describe',
  confirmatory_factor_analysis: 'describe',
  structural_equation_modelling: 'relationships',
  fleiss_kappa: 'frequencies',
  weighted_kappa: 'frequencies',
  kendalls_w: 'frequencies',
  fishers_exact: 'frequencies',
  odds_ratio: 'frequencies',
  relative_risk: 'frequencies',
  goodman_kruskal_gamma: 'relationships',
  somers_d: 'relationships',
  goodman_kruskal_lambda: 'relationships',
  mantel_haenszel: 'relationships',
  cochran_armitage: 'relationships',
  loglinear: 'frequencies',
  hierarchical_regression: 'prediction',
  anova_mixed: 'compare',
  anova_threeway: 'compare',
  moderation_analysis: 'prediction',
};

export const HISTORY_LIMIT = 20;
export const MAX_OPEN_DATASET_TABS = 8;

export type HistoryEntry = {
  id: string;
  iso: string;
  op: AnalysisKey;
  body: Record<string, unknown>;
  result: Record<string, unknown>;
  report: AnalysisReport;
};

export function isAnalysisKey(v: string | null | undefined): v is AnalysisKey {
  return !!v && v in ANALYSIS_LABELS;
}

export function parseCols(s: string): string[] | undefined {
  const p = s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
  return p.length ? p : undefined;
}

export type ConfidenceLevelKey = '0.9' | '0.95' | '0.99';

export type AnovaPostHocKey = 'none' | 'tukey' | 'bonferroni' | 'scheffe' | 'games_howell';

export type AnalysisFormSetters = {
  setSelectedCols: (cols: string[]) => void;
  setGroupCol: (s: string) => void;
  setValueCol: (s: string) => void;
  setDepCol: (s: string) => void;
  setIndependentCols: (cols: string[]) => void;
  setChiA: (s: string) => void;
  setChiB: (s: string) => void;
  setAnovaPostHoc: (v: AnovaPostHocKey) => void;
  setCorrelationMethod: (v: 'pearson' | 'spearman' | 'kendall') => void;
  setConfidenceLevel: (v: ConfidenceLevelKey) => void;
  setPairedBeforeCol: (v: string) => void;
  setPairedAfterCol: (v: string) => void;
  setOneSampleCol: (v: string) => void;
  setHypothesizedMean: (v: string) => void;
};

export function applyBodyToForm(
  op: AnalysisKey,
  body: Record<string, unknown>,
  setters: AnalysisFormSetters
) {
  const {
    setSelectedCols,
    setGroupCol,
    setValueCol,
    setDepCol,
    setIndependentCols,
    setChiA,
    setChiB,
    setAnovaPostHoc,
    setCorrelationMethod,
    setConfidenceLevel,
    setPairedBeforeCol,
    setPairedAfterCol,
    setOneSampleCol,
    setHypothesizedMean,
  } = setters;
  if (op === 'descriptives' || op === 'correlation') {
    const cols = body.columns as string[] | undefined;
    setSelectedCols(cols?.length ? cols : []);
    if (op === 'correlation') {
      const method = body.method;
      if (method === 'pearson' || method === 'spearman' || method === 'kendall')
        setCorrelationMethod(method);
    }
  }
  if (
    op === 'ttest_independent' ||
    op === 'anova_oneway' ||
    op === 'mann_whitney_u' ||
    op === 'kruskal_wallis'
  ) {
    if (typeof body.group_column === 'string') setGroupCol(body.group_column);
    if (typeof body.value_column === 'string') setValueCol(body.value_column);
    if (typeof body.confidence_level === 'number') {
      const cl = body.confidence_level;
      if (cl === 0.9) setConfidenceLevel('0.9');
      else if (cl === 0.99) setConfidenceLevel('0.99');
      else setConfidenceLevel('0.95');
    }
  }
  if (op === 'ttest_paired' || op === 'wilcoxon_signed_rank') {
    if (typeof body.before_column === 'string') setPairedBeforeCol(body.before_column);
    if (typeof body.after_column === 'string') setPairedAfterCol(body.after_column);
    if (typeof body.confidence_level === 'number') {
      const cl = body.confidence_level;
      if (cl === 0.9) setConfidenceLevel('0.9');
      else if (cl === 0.99) setConfidenceLevel('0.99');
      else setConfidenceLevel('0.95');
    }
  }
  if (op === 'anova_oneway') {
    const ph = body.post_hoc;
    if (ph === 'tukey' || ph === 'none' || ph === 'bonferroni' || ph === 'scheffe')
      setAnovaPostHoc(ph);
  }
  if (
    op === 'linear_regression' ||
    op === 'logistic_regression' ||
    op === 'poisson_regression' ||
    op === 'probit_regression' ||
    op === 'negative_binomial_regression' ||
    op === 'ordinal_regression'
  ) {
    if (typeof body.dependent === 'string') setDepCol(body.dependent);
    const inds = body.independents as string[] | undefined;
    setIndependentCols(inds ?? []);
  }
  if (op === 'canonical_correlation') {
    const setA = body.set_a as string[] | undefined;
    const setB = body.set_b as string[] | undefined;
    if (setA?.length) setSelectedCols(setA);
    if (setB?.length) setIndependentCols(setB);
  }
  if (op === 'shapiro_wilk' || op === 'lilliefors_ks' || op === 'runs_test') {
    if (typeof body.column === 'string') setOneSampleCol(body.column);
  }
  if (op === 'chi_square') {
    if (typeof body.column_a === 'string') setChiA(body.column_a);
    if (typeof body.column_b === 'string') setChiB(body.column_b);
  }
  if (
    op === 'friedman' ||
    op === 'reliability_cronbach' ||
    op === 'pca' ||
    op === 'efa' ||
    op === 'anova_repeated' ||
    op === 'manova' ||
    op === 'cluster_analysis' ||
    op === 'discriminant_analysis' ||
    op === 'cochrans_q' ||
    op === 'multidimensional_scaling' ||
    op === 'hotelling_t2'
  ) {
    const cols = body.measure_columns as string[] | undefined;
    const relCols = body.columns as string[] | undefined;
    const pcaCols = body.columns as string[] | undefined;
    const depCols = body.dependent_columns as string[] | undefined;
    setSelectedCols(
      cols?.length
        ? cols
        : depCols?.length
          ? depCols
          : relCols?.length
            ? relCols
            : pcaCols?.length
              ? pcaCols
              : []
    );
  }
  if (op === 'partial_correlation') {
    if (typeof body.column_x === 'string') setPairedBeforeCol(body.column_x);
    if (typeof body.column_y === 'string') setPairedAfterCol(body.column_y);
    const controls = body.control_columns as string[] | undefined;
    setIndependentCols(controls ?? []);
  }
  if (op === 'chi_square') {
    if (typeof body.column_a === 'string') setChiA(body.column_a);
    if (typeof body.column_b === 'string') setChiB(body.column_b);
  }
  if (op === 'cohens_kappa' || op === 'mcnemar') {
    if (typeof body.column_a === 'string') setChiA(body.column_a);
    if (typeof body.column_b === 'string') setChiB(body.column_b);
  }
  if (op === 'kolmogorov_smirnov') {
    if (typeof body.column_a === 'string') setPairedBeforeCol(body.column_a);
    if (typeof body.column_b === 'string') setPairedAfterCol(body.column_b);
  }
  if (op === 'ttest_one_sample') {
    if (typeof body.value_column === 'string') setOneSampleCol(body.value_column);
    if (typeof body.hypothesized_mean === 'number')
      setHypothesizedMean(String(body.hypothesized_mean));
    if (typeof body.confidence_level === 'number') {
      const cl = body.confidence_level;
      if (cl === 0.9) setConfidenceLevel('0.9');
      else if (cl === 0.99) setConfidenceLevel('0.99');
      else setConfidenceLevel('0.95');
    }
  }
}

export function formatVariablesLine(op: AnalysisKey, body: Record<string, unknown>): string {
  if (op === 'descriptives' || op === 'correlation') {
    const cols = body.columns as string[] | undefined;
    return cols?.length ? cols.join(', ') : 'All applicable columns';
  }
  if (op === 'ttest_independent') {
    return `${body.value_column} by ${body.group_column}`;
  }
  if (op === 'ttest_paired' || op === 'wilcoxon_signed_rank') {
    return `${body.before_column} vs ${body.after_column}`;
  }
  if (op === 'friedman') {
    const cols = body.measure_columns as string[] | undefined;
    return cols?.length ? cols.join(', ') : '';
  }
  if (op === 'reliability_cronbach') {
    const cols = body.columns as string[] | undefined;
    return cols?.length ? cols.join(', ') : '';
  }
  if (op === 'kolmogorov_smirnov') {
    if (body.test_type === 'normality') return String(body.column_a);
    return `${body.column_a} vs ${body.column_b}`;
  }
  if (op === 'partial_correlation') {
    return `${body.column_x} | controls: ${(body.control_columns as string[] | undefined)?.join(', ') || 'none'}`;
  }
  if (op === 'pca') {
    const cols = body.columns as string[] | undefined;
    return cols?.length ? cols.join(', ') : '';
  }
  if (op === 'anova_twoway') {
    return `${body.value_column} by ${body.factor_a} × ${body.factor_b}`;
  }
  if (op === 'anova_repeated') {
    return `subject ${body.subject_column}; ${(body.measure_columns as string[] | undefined)?.join(', ')}`;
  }
  if (op === 'cohens_kappa') {
    return `${body.column_a} vs ${body.column_b}`;
  }
  if (op === 'efa') {
    const cols = body.columns as string[] | undefined;
    return cols?.length ? cols.join(', ') : '';
  }
  if (op === 'discriminant_analysis') {
    return `${body.group_column} · ${(body.columns as string[] | undefined)?.join(', ') || ''}`;
  }
  if (op === 'cluster_analysis') {
    return `${body.method} · k=${body.n_clusters}`;
  }
  if (op === 'manova') {
    return `${body.group_column} · ${(body.dependent_columns as string[] | undefined)?.join(', ') || ''}`;
  }
  if (op === 'ancova') {
    return `${body.outcome_column} by ${body.group_column} | ${body.covariate_column}`;
  }
  if (op === 'decision_tree') {
    const inds = (body.independents as string[] | undefined) ?? [];
    return `${body.dependent} ~ ${inds.join(', ')}`;
  }
  if (
    op === 'random_forest_classification' ||
    op === 'random_forest_regression' ||
    op === 'svm_classification' ||
    op === 'gradient_boosting' ||
    op === 'neural_network_mlp'
  ) {
    const inds = (body.independents as string[] | undefined) ?? [];
    const mode = body.mode ? ` · ${body.mode}` : '';
    return `${body.dependent} ~ ${inds.join(', ')}${mode}`;
  }
  if (op === 'dbscan') {
    const cols = (body.columns as string[] | undefined) ?? [];
    return `${cols.join(', ')} · ε=${body.epsilon ?? 0.5}`;
  }
  if (
    op === 'arima_sarima' ||
    op === 'exponential_smoothing' ||
    op === 'stl_decomposition' ||
    op === 'stationarity_tests' ||
    op === 'autocorrelation'
  ) {
    const date = body.date_column ? ` · ${body.date_column}` : '';
    return `${body.target_column}${date}`;
  }
  if (op === 'kaplan_meier') {
    const g = body.group_column ? ` · ${body.group_column}` : '';
    return `${body.duration_column} / ${body.event_column}${g}`;
  }
  if (op === 'cox_proportional_hazards') {
    const cov = (body.covariates as string[] | undefined) ?? [];
    return `${body.duration_column} ~ ${cov.join(', ')}`;
  }
  if (op === 'nelson_aalen') {
    return `${body.duration_column} / ${body.event_column}`;
  }
  if (op === 'linear_mixed_model' || op === 'generalized_linear_mixed_model') {
    const fixed = (body.fixed_effects as string[] | undefined) ?? [];
    return `${body.dependent} ~ ${fixed.join(', ')} | ${body.group_column}`;
  }
  if (op === 'multilevel_modelling') {
    const preds = (body.level1_predictors as string[] | undefined) ?? [];
    return `${body.outcome_column} ~ ${preds.join(', ')} | ${body.level2_group_column}`;
  }
  if (op === 'latent_class_analysis') {
    const ind = (body.indicators as string[] | undefined) ?? [];
    return `${ind.join(', ')} · k=${body.n_classes ?? 2}`;
  }
  if (op === 'confirmatory_factor_analysis' || op === 'structural_equation_modelling') {
    return String(body.model_spec ?? '').split('\n')[0] || '';
  }
  if (op === 'anova_oneway') {
    const base = `${body.value_column} by ${body.group_column}`;
    return body.post_hoc === 'tukey' ? `${base} · Tukey HSD` : base;
  }
  if (op === 'linear_regression') {
    const inds = (body.independents as string[] | undefined) ?? [];
    const method = body.method && body.method !== 'enter' ? ` · ${body.method}` : '';
    return `${body.dependent} ~ ${inds.join(', ')}${method}`;
  }
  if (op === 'logistic_regression') {
    const inds = (body.independents as string[] | undefined) ?? [];
    return `logit(${body.dependent}) ~ ${inds.join(', ')}`;
  }
  if (op === 'chi_square') {
    return `${body.column_a} × ${body.column_b}`;
  }
  if (op === 'ttest_one_sample') {
    return `${body.value_column} vs μ = ${body.hypothesized_mean}`;
  }
  return '';
}

function confidenceLevelNumber(key: ConfidenceLevelKey): number {
  return Number(key) || 0.95;
}

export function buildBodyFromForm(form: AnalysisFormState): Record<string, unknown> {
  const {
    analysis,
    selectedCols,
    groupCol,
    valueCol,
    depCol,
    independentCols,
    chiA,
    chiB,
    anovaPostHoc,
    correlationMethod,
    correlationSignificance,
    flagSignificantCorrelations,
    confidenceLevel,
    pairedBeforeCol,
    pairedAfterCol,
    oneSampleCol,
    hypothesizedMean,
    hypothesizedDifference,
    groupValues,
    descriptiveStats,
    anovaEffectSize,
    anovaDescriptivesByGroup,
    anovaHomogeneity,
    anovaWelchCorrection,
    anovaMissingValues,
    anovaOutputChart,
    kruskalPostHoc,
    regressionMethod,
    regressionIncludeConstant,
    regressionMissingValues,
    regressionResidualPlots,
    regressionCollinearity,
    logisticCutoff,
    logisticMaxIterations,
    logisticHosmerLemeshow,
    logisticIncludeConstant,
    ksTestType,
    factorBCol,
    subjectCol,
    pcaNComponents,
    anovaInteraction,
    covariateCol,
    clusterMethod,
    clusterStandardize,
    treeMaxDepth,
    chiIncludePhi,
    chiIncludeCramersV,
    chiUseFishersExact,
    kappaWeights,
    factorCCol,
    runsTestCutoff,
    mlMode,
    dbscanEpsilon,
    dbscanMinSamples,
    dateCol,
    seasonalPeriod,
    forecastSteps,
    acfMaxLags,
    durationCol,
    eventCol,
    semModelSpec,
    glmmFamily,
  } = form;

  if (analysis === 'descriptives') {
    const statistics = (Object.entries(descriptiveStats) as [DescriptiveStatKey, boolean][])
      .filter(([, on]) => on)
      .map(([key]) => key);
    return {
      columns: selectedCols.length ? selectedCols : undefined,
      statistics: statistics.length ? statistics : undefined,
    };
  }
  if (analysis === 'correlation') {
    return {
      columns: selectedCols.length ? selectedCols : undefined,
      method: correlationMethod,
      significance_alpha: 1 - confidenceLevelNumber(confidenceLevel),
      tail: correlationSignificance,
      flag_significant: flagSignificantCorrelations,
    };
  }
  if (analysis === 'ttest_independent') {
    const gv = groupValues
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    return {
      group_column: groupCol,
      value_column: valueCol,
      confidence_level: confidenceLevelNumber(confidenceLevel),
      hypothesized_difference: Number(hypothesizedDifference) || 0,
      missing_values: anovaMissingValues,
      ...(gv.length === 2 ? { group_values: gv } : {}),
    };
  }
  if (analysis === 'ttest_paired') {
    return {
      before_column: pairedBeforeCol,
      after_column: pairedAfterCol,
      confidence_level: confidenceLevelNumber(confidenceLevel),
    };
  }
  if (analysis === 'anova_oneway') {
    const postHoc =
      anovaPostHoc === 'tukey' ||
      anovaPostHoc === 'bonferroni' ||
      anovaPostHoc === 'scheffe' ||
      anovaPostHoc === 'games_howell'
        ? anovaPostHoc
        : 'none';
    return {
      group_column: groupCol,
      value_column: valueCol,
      post_hoc: postHoc,
      confidence_level: confidenceLevelNumber(confidenceLevel),
      include_group_descriptives: anovaDescriptivesByGroup,
      homogeneity_test: anovaHomogeneity,
      use_welch: anovaWelchCorrection,
      effect_size: anovaEffectSize,
      missing_values: anovaMissingValues,
      output_chart: anovaOutputChart,
    };
  }
  if (analysis === 'mann_whitney_u') {
    return { group_column: groupCol, value_column: valueCol };
  }
  if (analysis === 'kruskal_wallis') {
    return {
      group_column: groupCol,
      value_column: valueCol,
      post_hoc: kruskalPostHoc,
      confidence_level: confidenceLevelNumber(confidenceLevel),
    };
  }
  if (analysis === 'wilcoxon_signed_rank') {
    return {
      before_column: pairedBeforeCol,
      after_column: pairedAfterCol,
      confidence_level: confidenceLevelNumber(confidenceLevel),
    };
  }
  if (analysis === 'friedman') {
    if (selectedCols.length < 3) throw new Error('Select at least three measure columns');
    return { measure_columns: selectedCols };
  }
  if (analysis === 'kolmogorov_smirnov') {
    if (ksTestType === 'normality') {
      return { test_type: 'normality', column_a: pairedBeforeCol };
    }
    return { test_type: 'two_sample', column_a: pairedBeforeCol, column_b: pairedAfterCol };
  }
  if (analysis === 'reliability_cronbach') {
    if (selectedCols.length < 2) throw new Error('Select at least two items');
    return { columns: selectedCols };
  }
  if (analysis === 'partial_correlation') {
    return {
      column_x: pairedBeforeCol,
      column_y: pairedAfterCol,
      control_columns: independentCols,
      method: correlationMethod,
    };
  }
  if (analysis === 'pca') {
    if (selectedCols.length < 2) throw new Error('Select at least two variables');
    const n = pcaNComponents.trim() ? Number(pcaNComponents) : undefined;
    return {
      columns: selectedCols,
      n_components: n && !Number.isNaN(n) ? n : undefined,
    };
  }
  if (analysis === 'anova_twoway') {
    return {
      factor_a: groupCol,
      factor_b: factorBCol,
      value_column: valueCol,
      include_interaction: anovaInteraction,
    };
  }
  if (analysis === 'anova_repeated') {
    if (!subjectCol.trim()) throw new Error('Select a subject ID column');
    if (selectedCols.length < 2) throw new Error('Select at least two measure columns');
    return { subject_column: subjectCol, measure_columns: selectedCols };
  }
  if (analysis === 'poisson_regression') {
    if (!independentCols.length) throw new Error('Add at least one predictor');
    return {
      dependent: depCol,
      independents: independentCols,
      confidence_level: confidenceLevelNumber(confidenceLevel),
      include_constant: regressionIncludeConstant,
    };
  }
  if (analysis === 'cohens_kappa') {
    return { column_a: chiA, column_b: chiB };
  }
  if (analysis === 'efa') {
    if (selectedCols.length < 2) throw new Error('Select at least two variables');
    const n = pcaNComponents.trim() ? Number(pcaNComponents) : undefined;
    return {
      columns: selectedCols,
      n_factors: n && !Number.isNaN(n) ? n : undefined,
    };
  }
  if (analysis === 'discriminant_analysis') {
    if (!groupCol.trim()) throw new Error('Select a grouping variable');
    const features = selectedCols.length >= 1 ? selectedCols : independentCols;
    if (features.length < 1) throw new Error('Select at least one predictor');
    return { group_column: groupCol, columns: features, feature_columns: features };
  }
  if (analysis === 'cluster_analysis') {
    if (selectedCols.length < 1) throw new Error('Select at least one variable');
    const k = pcaNComponents.trim() ? Number(pcaNComponents) : 3;
    return {
      columns: selectedCols,
      method: clusterMethod,
      n_clusters: !Number.isNaN(k) && k >= 2 ? k : 3,
      standardize: clusterStandardize,
    };
  }
  if (analysis === 'manova') {
    if (!groupCol.trim()) throw new Error('Select a grouping variable');
    if (selectedCols.length < 2) throw new Error('Select at least two dependent variables');
    return { group_column: groupCol, dependent_columns: selectedCols };
  }
  if (analysis === 'ancova') {
    if (!groupCol.trim() || !valueCol.trim() || !covariateCol.trim()) {
      throw new Error('Select group, outcome, and covariate');
    }
    return {
      group_column: groupCol,
      outcome_column: valueCol,
      covariate_column: covariateCol,
      include_interaction: anovaInteraction,
    };
  }
  if (analysis === 'decision_tree') {
    if (!independentCols.length) throw new Error('Add at least one predictor');
    const depth = treeMaxDepth.trim() ? Number(treeMaxDepth) : undefined;
    return {
      dependent: depCol,
      independents: independentCols,
      max_depth: depth && !Number.isNaN(depth) ? depth : undefined,
    };
  }
  if (analysis === 'linear_regression') {
    if (!independentCols.length) throw new Error('Add at least one predictor');
    return {
      dependent: depCol,
      independents: independentCols,
      confidence_level: confidenceLevelNumber(confidenceLevel),
      include_constant: regressionIncludeConstant,
      method: regressionMethod,
      missing_values: regressionMissingValues,
      residual_plots: regressionResidualPlots,
      collinearity_diagnostics: regressionCollinearity,
    };
  }
  if (analysis === 'stepwise_regression') {
    if (!independentCols.length) throw new Error('Add at least one predictor');
    return {
      dependent: depCol,
      independents: independentCols,
      method: 'stepwise',
      confidence_level: confidenceLevelNumber(confidenceLevel),
      include_constant: regressionIncludeConstant,
      missing_values: regressionMissingValues,
      collinearity_diagnostics: regressionCollinearity,
    };
  }
  if (analysis === 'logistic_regression') {
    if (!independentCols.length) throw new Error('Add at least one predictor');
    return {
      dependent: depCol,
      independents: independentCols,
      confidence_level: confidenceLevelNumber(confidenceLevel),
      classification_cutoff: Number(logisticCutoff) || 0.5,
      max_iter: Number(logisticMaxIterations) || 20,
      include_constant: logisticIncludeConstant,
      hosmer_lemeshow: logisticHosmerLemeshow,
    };
  }
  if (analysis === 'chi_square') {
    if (chiUseFishersExact) {
      return { column_a: chiA, column_b: chiB };
    }
    return {
      column_a: chiA,
      column_b: chiB,
      include_phi: chiIncludePhi,
      include_cramers_v: chiIncludeCramersV,
      use_fishers_exact: false,
    };
  }
  if (analysis === 'fishers_exact' || analysis === 'odds_ratio' || analysis === 'relative_risk') {
    return { column_a: chiA, column_b: chiB };
  }
  if (analysis === 'weighted_kappa') {
    return { column_a: chiA, column_b: chiB, weights: kappaWeights };
  }
  if (analysis === 'fleiss_kappa') {
    if (selectedCols.length < 3) throw new Error('Select at least three rater columns');
    return { columns: selectedCols };
  }
  if (analysis === 'kendalls_w') {
    if (selectedCols.length < 2) throw new Error('Select at least two judge columns');
    return { columns: selectedCols };
  }
  if (
    analysis === 'goodman_kruskal_gamma' ||
    analysis === 'somers_d' ||
    analysis === 'goodman_kruskal_lambda'
  ) {
    return { column_a: chiA, column_b: chiB };
  }
  if (analysis === 'mantel_haenszel' || analysis === 'cochran_armitage') {
    return { group_column: groupCol, outcome_column: valueCol };
  }
  if (analysis === 'loglinear') {
    if (selectedCols.length < 2) throw new Error('Select at least two categorical variables');
    return { columns: selectedCols, model: 'saturated', max_iterations: 20 };
  }
  if (analysis === 'hierarchical_regression') {
    if (!independentCols.length) throw new Error('Add at least one predictor in block 1');
    const blocks = [independentCols];
    if (selectedCols.length) blocks.push(selectedCols);
    return {
      dependent: depCol,
      blocks,
      method: 'enter',
      confidence_level: confidenceLevelNumber(confidenceLevel),
    };
  }
  if (analysis === 'anova_mixed') {
    if (!subjectCol.trim()) throw new Error('Select a subject ID column');
    if (selectedCols.length < 2) throw new Error('Select at least two within-subject measures');
    return {
      subject_column: subjectCol,
      between_factor: groupCol,
      within_measures: selectedCols,
      confidence_level: confidenceLevelNumber(confidenceLevel),
    };
  }
  if (analysis === 'anova_threeway') {
    return {
      factor_a: groupCol,
      factor_b: factorBCol,
      factor_c: factorCCol,
      value_column: valueCol,
      include_interactions: anovaInteraction,
      confidence_level: confidenceLevelNumber(confidenceLevel),
    };
  }
  if (analysis === 'moderation_analysis') {
    return {
      outcome_column: depCol,
      predictor_column: valueCol,
      moderator_column: groupCol,
      center_variables: true,
      confidence_level: confidenceLevelNumber(confidenceLevel),
    };
  }
  if (analysis === 'shapiro_wilk' || analysis === 'lilliefors_ks' || analysis === 'runs_test') {
    if (analysis === 'runs_test') {
      return { column: oneSampleCol, cutoff: runsTestCutoff };
    }
    return { column: oneSampleCol };
  }
  if (analysis === 'sign_test') {
    return {
      before_column: pairedBeforeCol,
      after_column: pairedAfterCol,
    };
  }
  if (analysis === 'probit_regression') {
    if (!independentCols.length) throw new Error('Add at least one predictor');
    return {
      dependent: depCol,
      independents: independentCols,
      confidence_level: confidenceLevelNumber(confidenceLevel),
      include_constant: regressionIncludeConstant,
    };
  }
  if (analysis === 'mcnemar') {
    return { column_a: chiA, column_b: chiB };
  }
  if (analysis === 'negative_binomial_regression') {
    if (!independentCols.length) throw new Error('Add at least one predictor');
    return {
      dependent: depCol,
      independents: independentCols,
      confidence_level: confidenceLevelNumber(confidenceLevel),
      include_constant: regressionIncludeConstant,
    };
  }
  if (analysis === 'ordinal_regression') {
    if (!independentCols.length) throw new Error('Add at least one predictor');
    return {
      dependent: depCol,
      independents: independentCols,
      confidence_level: confidenceLevelNumber(confidenceLevel),
      include_constant: false,
    };
  }
  if (
    analysis === 'median_test' ||
    analysis === 'jonckheere_terpstra' ||
    analysis === 'moses_test'
  ) {
    return { group_column: groupCol, value_column: valueCol };
  }
  if (analysis === 'cochrans_q') {
    if (selectedCols.length < 3) throw new Error('Select at least three dichotomous variables');
    return { measure_columns: selectedCols };
  }
  if (analysis === 'canonical_correlation') {
    if (selectedCols.length < 1 || independentCols.length < 1) {
      throw new Error('Select at least one variable in each set');
    }
    return { set_a: selectedCols, set_b: independentCols };
  }
  if (analysis === 'multidimensional_scaling') {
    if (selectedCols.length < 2) throw new Error('Select at least two variables');
    const n = pcaNComponents.trim() ? Number(pcaNComponents) : 2;
    return {
      columns: selectedCols,
      n_components: !Number.isNaN(n) && n >= 1 ? n : 2,
    };
  }
  if (analysis === 'hotelling_t2') {
    if (selectedCols.length < 1) throw new Error('Select at least one dependent variable');
    return { group_column: groupCol, dependent_columns: selectedCols };
  }
  if (analysis === 'random_forest_classification' || analysis === 'svm_classification') {
    if (!independentCols.length) throw new Error('Add at least one feature');
    return { dependent: depCol, independents: independentCols, test_fraction: 0.25 };
  }
  if (analysis === 'random_forest_regression') {
    if (!independentCols.length) throw new Error('Add at least one feature');
    return { dependent: depCol, independents: independentCols, test_fraction: 0.25 };
  }
  if (analysis === 'gradient_boosting' || analysis === 'neural_network_mlp') {
    if (!independentCols.length) throw new Error('Add at least one feature');
    return {
      dependent: depCol,
      independents: independentCols,
      mode: mlMode,
      test_fraction: 0.25,
    };
  }
  if (analysis === 'dbscan') {
    if (selectedCols.length < 1) throw new Error('Select at least one feature');
    const eps = Number(dbscanEpsilon) || 0.5;
    const minS = Number(dbscanMinSamples) || 5;
    return {
      columns: selectedCols,
      epsilon: eps,
      min_samples: minS,
      standardize: clusterStandardize,
    };
  }
  if (analysis === 'arima_sarima') {
    const period = seasonalPeriod.trim() ? Number(seasonalPeriod) : undefined;
    const steps = Number(forecastSteps) || 12;
    return {
      target_column: valueCol,
      date_column: dateCol.trim() || undefined,
      seasonal_period: period && period >= 2 ? period : undefined,
      forecast_steps: steps,
    };
  }
  if (analysis === 'exponential_smoothing') {
    const period = Number(seasonalPeriod) || 12;
    const steps = Number(forecastSteps) || 12;
    return {
      target_column: valueCol,
      date_column: dateCol.trim() || undefined,
      seasonal_period: period,
      forecast_steps: steps,
    };
  }
  if (analysis === 'stl_decomposition') {
    const period = Number(seasonalPeriod) || 12;
    return {
      target_column: valueCol,
      date_column: dateCol.trim() || undefined,
      period,
    };
  }
  if (analysis === 'stationarity_tests') {
    return {
      target_column: valueCol,
      date_column: dateCol.trim() || undefined,
    };
  }
  if (analysis === 'autocorrelation') {
    const maxLags = Number(acfMaxLags) || 20;
    return {
      target_column: valueCol,
      date_column: dateCol.trim() || undefined,
      max_lags: maxLags,
    };
  }
  if (analysis === 'kaplan_meier') {
    return {
      duration_column: durationCol,
      event_column: eventCol,
      group_column: groupCol.trim() || undefined,
    };
  }
  if (analysis === 'cox_proportional_hazards') {
    if (!independentCols.length) throw new Error('Add at least one covariate');
    return {
      duration_column: durationCol,
      event_column: eventCol,
      covariates: independentCols,
    };
  }
  if (analysis === 'nelson_aalen') {
    return {
      duration_column: durationCol,
      event_column: eventCol,
    };
  }
  if (analysis === 'linear_mixed_model') {
    if (!independentCols.length) throw new Error('Add at least one fixed effect');
    return {
      dependent: depCol,
      fixed_effects: independentCols,
      group_column: groupCol,
    };
  }
  if (analysis === 'generalized_linear_mixed_model') {
    if (!independentCols.length) throw new Error('Add at least one fixed effect');
    return {
      dependent: depCol,
      fixed_effects: independentCols,
      group_column: groupCol,
      family: glmmFamily,
    };
  }
  if (analysis === 'multilevel_modelling') {
    if (!independentCols.length) throw new Error('Add at least one level-1 predictor');
    return {
      outcome_column: valueCol,
      level1_predictors: independentCols,
      level2_group_column: groupCol,
    };
  }
  if (analysis === 'latent_class_analysis') {
    if (selectedCols.length < 1) throw new Error('Select at least one indicator');
    const k = Number(pcaNComponents) || 2;
    return {
      indicators: selectedCols,
      n_classes: k >= 2 && k <= 10 ? k : 2,
    };
  }
  if (analysis === 'confirmatory_factor_analysis') {
    if (selectedCols.length < 2) throw new Error('Select at least two indicators');
    if (!semModelSpec.trim()) throw new Error('Enter a factor structure (semopy syntax)');
    return {
      indicators: selectedCols,
      model_spec: semModelSpec.trim(),
    };
  }
  if (analysis === 'structural_equation_modelling') {
    if (!semModelSpec.trim()) throw new Error('Enter a model specification (semopy syntax)');
    return {
      model_spec: semModelSpec.trim(),
      columns: selectedCols.length ? selectedCols : undefined,
    };
  }
  if (analysis === 'ttest_one_sample') {
    return {
      value_column: oneSampleCol,
      hypothesized_mean: Number(hypothesizedMean) || 0,
      confidence_level: confidenceLevelNumber(confidenceLevel),
    };
  }
  return {};
}

function inferSubjectColumnFromSchema(schema: SchemaColumn[]): string {
  const hints = ['player', 'subject', 'participant', 'case', 'id'];
  let best = '';
  let bestScore = 0;
  for (const col of schema) {
    const n = col.name.toLowerCase();
    let score = 0;
    for (const hint of hints) {
      if (n === hint) score = Math.max(score, 25);
      else if (n.includes(hint)) score = Math.max(score, 15);
    }
    if (score > bestScore) {
      bestScore = score;
      best = col.name;
    }
  }
  return best || schema.find(c => c.type === 'categorical')?.name || schema[0]?.name || '';
}

/** Keys used for palette search (label + category + api key). */
export function analysisSearchBlob(key: AnalysisKey): string {
  const cat = PALETTE_CATEGORY_TITLES[ANALYSIS_PALETTE_CATEGORY[key]];
  return `${key} ${ANALYSIS_LABELS[key]} ${cat}`.toLowerCase();
}

export function defaultFormFieldsFromSchema(
  schema: SchemaColumn[]
): Omit<AnalysisFormState, 'analysis'> {
  const num = schema.filter(c => c.type === 'numeric').map(c => c.name);
  return {
    selectedCols: [],
    groupCol: schema[0]?.name ?? '',
    valueCol: num[0] ?? schema[0]?.name ?? '',
    depCol: num[0] ?? schema[0]?.name ?? '',
    independentCols: num.slice(1, 3),
    chiA: schema[0]?.name ?? '',
    chiB: schema[Math.min(1, Math.max(0, schema.length - 1))]?.name ?? '',
    anovaPostHoc: 'none',
    anovaEffectSize: 'eta_squared',
    anovaHomogeneity: 'levene',
    anovaDescriptivesByGroup: true,
    anovaWelchCorrection: false,
    anovaMissingValues: 'listwise',
    anovaOutputChart: 'boxplot',
    correlationMethod: 'pearson',
    correlationSignificance: 'two_tailed',
    flagSignificantCorrelations: false,
    confidenceLevel: '0.95',
    pairedBeforeCol: num[0] ?? schema[0]?.name ?? '',
    pairedAfterCol: num[1] ?? schema[Math.min(1, Math.max(0, schema.length - 1))]?.name ?? '',
    oneSampleCol: num[0] ?? schema[0]?.name ?? '',
    hypothesizedMean: '0',
    hypothesizedDifference: '0',
    groupValues: '',
    descriptiveStats: { ...DEFAULT_DESCRIPTIVE_STATS },
    kruskalPostHoc: false,
    regressionMethod: 'enter',
    regressionIncludeConstant: true,
    regressionMissingValues: 'listwise',
    regressionResidualPlots: 'none',
    regressionCollinearity: false,
    logisticCutoff: '0.5',
    logisticMaxIterations: '20',
    logisticHosmerLemeshow: false,
    logisticIncludeConstant: true,
    ksTestType: 'two_sample',
    factorBCol: schema[Math.min(1, Math.max(0, schema.length - 1))]?.name ?? '',
    subjectCol: inferSubjectColumnFromSchema(schema),
    pcaNComponents: '',
    anovaInteraction: true,
    covariateCol: num[1] ?? schema[Math.min(1, Math.max(0, schema.length - 1))]?.name ?? '',
    clusterMethod: 'kmeans' as const,
    clusterStandardize: true,
    treeMaxDepth: '',
    chiIncludePhi: true,
    chiIncludeCramersV: true,
    chiUseFishersExact: false,
    kappaWeights: 'linear' as const,
    factorCCol: schema[Math.min(2, Math.max(0, schema.length - 1))]?.name ?? '',
    runsTestCutoff: 'median',
    mlMode: 'classification' as const,
    dbscanEpsilon: '0.5',
    dbscanMinSamples: '5',
    dateCol:
      schema.find(c => c.type?.toLowerCase().includes('date'))?.name ?? schema[0]?.name ?? '',
    seasonalPeriod: '12',
    forecastSteps: '12',
    acfMaxLags: '20',
    durationCol: num[0] ?? schema[0]?.name ?? '',
    eventCol: num[1] ?? schema[Math.min(1, Math.max(0, schema.length - 1))]?.name ?? '',
    semModelSpec: 'F1 =~ item1 + item2 + item3',
    glmmFamily: 'binomial' as const,
  };
}

export type AnalysisFormState = {
  analysis: AnalysisKey;
  selectedCols: string[];
  groupCol: string;
  valueCol: string;
  depCol: string;
  independentCols: string[];
  chiA: string;
  chiB: string;
  anovaPostHoc: AnovaPostHocKey;
  anovaEffectSize: AnovaEffectSizeKey;
  anovaHomogeneity: AnovaHomogeneityKey;
  anovaDescriptivesByGroup: boolean;
  anovaWelchCorrection: boolean;
  anovaMissingValues: 'listwise' | 'pairwise';
  anovaOutputChart: AnovaOutputChartKey;
  correlationMethod: 'pearson' | 'spearman' | 'kendall';
  correlationSignificance: CorrelationSignificanceKey;
  flagSignificantCorrelations: boolean;
  confidenceLevel: ConfidenceLevelKey;
  pairedBeforeCol: string;
  pairedAfterCol: string;
  oneSampleCol: string;
  hypothesizedMean: string;
  hypothesizedDifference: string;
  /** Comma-separated group labels for independent t-test subset comparisons */
  groupValues: string;
  descriptiveStats: Record<DescriptiveStatKey, boolean>;
  kruskalPostHoc: boolean;
  regressionMethod: RegressionMethodKey;
  regressionIncludeConstant: boolean;
  regressionMissingValues: 'listwise' | 'pairwise';
  regressionResidualPlots: RegressionResidualPlotsKey;
  regressionCollinearity: boolean;
  logisticCutoff: string;
  logisticMaxIterations: string;
  logisticHosmerLemeshow: boolean;
  logisticIncludeConstant: boolean;
  ksTestType: KolmogorovTestType;
  factorBCol: string;
  subjectCol: string;
  pcaNComponents: string;
  anovaInteraction: boolean;
  covariateCol: string;
  clusterMethod: 'kmeans' | 'hierarchical';
  clusterStandardize: boolean;
  treeMaxDepth: string;
  chiIncludePhi: boolean;
  chiIncludeCramersV: boolean;
  chiUseFishersExact: boolean;
  kappaWeights: 'linear' | 'quadratic';
  factorCCol: string;
  runsTestCutoff: 'median' | 'mean';
  mlMode: 'classification' | 'regression';
  dbscanEpsilon: string;
  dbscanMinSamples: string;
  dateCol: string;
  seasonalPeriod: string;
  forecastSteps: string;
  acfMaxLags: string;
  durationCol: string;
  eventCol: string;
  semModelSpec: string;
  glmmFamily: 'binomial' | 'poisson';
};

export function formStateFromBody(
  op: AnalysisKey,
  body: Record<string, unknown>,
  schema: SchemaColumn[]
): AnalysisFormState {
  const d = defaultFormFieldsFromSchema(schema);
  const state: AnalysisFormState = { analysis: op, ...d };
  applyBodyToForm(op, body, {
    setSelectedCols: cols => {
      state.selectedCols = cols;
    },
    setGroupCol: s => {
      state.groupCol = s;
    },
    setValueCol: s => {
      state.valueCol = s;
    },
    setDepCol: s => {
      state.depCol = s;
    },
    setIndependentCols: cols => {
      state.independentCols = cols;
    },
    setChiA: s => {
      state.chiA = s;
    },
    setChiB: s => {
      state.chiB = s;
    },
    setAnovaPostHoc: v => {
      state.anovaPostHoc = v;
    },
    setCorrelationMethod: v => {
      state.correlationMethod = v;
    },
    setConfidenceLevel: v => {
      state.confidenceLevel = v;
    },
    setPairedBeforeCol: v => {
      state.pairedBeforeCol = v;
    },
    setPairedAfterCol: v => {
      state.pairedAfterCol = v;
    },
    setOneSampleCol: v => {
      state.oneSampleCol = v;
    },
    setHypothesizedMean: v => {
      state.hypothesizedMean = v;
    },
  });
  if (
    op === 'ttest_independent' &&
    Array.isArray(body.group_values) &&
    body.group_values.length === 2
  ) {
    state.groupValues = body.group_values.map(String).join(', ');
  }
  if (op === 'kolmogorov_smirnov') {
    const tt = body.test_type;
    if (tt === 'normality' || tt === 'two_sample') state.ksTestType = tt;
  }
  if (op === 'anova_twoway') {
    if (typeof body.factor_a === 'string') state.groupCol = body.factor_a;
    if (typeof body.factor_b === 'string') state.factorBCol = body.factor_b;
    if (typeof body.value_column === 'string') state.valueCol = body.value_column;
    if (typeof body.include_interaction === 'boolean')
      state.anovaInteraction = body.include_interaction;
  }
  if (op === 'anova_repeated' && typeof body.subject_column === 'string') {
    state.subjectCol = body.subject_column;
  }
  if (op === 'pca' && body.n_components != null) {
    state.pcaNComponents = String(body.n_components);
  }
  if (op === 'efa' && body.n_factors != null) {
    state.pcaNComponents = String(body.n_factors);
  }
  if (op === 'ancova') {
    if (typeof body.group_column === 'string') state.groupCol = body.group_column;
    if (typeof body.outcome_column === 'string') state.valueCol = body.outcome_column;
    if (typeof body.covariate_column === 'string') state.covariateCol = body.covariate_column;
    if (typeof body.include_interaction === 'boolean')
      state.anovaInteraction = body.include_interaction;
  }
  if (op === 'discriminant_analysis' || op === 'manova') {
    if (typeof body.group_column === 'string') state.groupCol = body.group_column;
  }
  if (op === 'cluster_analysis') {
    const method = body.method;
    if (method === 'kmeans' || method === 'hierarchical') state.clusterMethod = method;
    if (typeof body.standardize === 'boolean') state.clusterStandardize = body.standardize;
    if (body.n_clusters != null) state.pcaNComponents = String(body.n_clusters);
  }
  if (op === 'decision_tree') {
    if (typeof body.dependent === 'string') state.depCol = body.dependent;
    const inds = body.independents as string[] | undefined;
    if (inds?.length) state.independentCols = inds;
    if (body.max_depth != null) state.treeMaxDepth = String(body.max_depth);
  }
  if (
    op === 'random_forest_classification' ||
    op === 'random_forest_regression' ||
    op === 'svm_classification' ||
    op === 'gradient_boosting' ||
    op === 'neural_network_mlp'
  ) {
    if (typeof body.dependent === 'string') state.depCol = body.dependent;
    const inds = body.independents as string[] | undefined;
    if (inds?.length) state.independentCols = inds;
    const mode = body.mode;
    if (mode === 'classification' || mode === 'regression') state.mlMode = mode;
  }
  if (op === 'dbscan') {
    const cols = body.columns as string[] | undefined;
    if (cols?.length) state.selectedCols = cols;
    if (body.epsilon != null) state.dbscanEpsilon = String(body.epsilon);
    if (body.min_samples != null) state.dbscanMinSamples = String(body.min_samples);
    if (typeof body.standardize === 'boolean') state.clusterStandardize = body.standardize;
  }
  if (
    op === 'arima_sarima' ||
    op === 'exponential_smoothing' ||
    op === 'stl_decomposition' ||
    op === 'stationarity_tests' ||
    op === 'autocorrelation'
  ) {
    if (typeof body.target_column === 'string') state.valueCol = body.target_column;
    if (typeof body.date_column === 'string') state.dateCol = body.date_column;
    if (body.seasonal_period != null) state.seasonalPeriod = String(body.seasonal_period);
    if (body.period != null) state.seasonalPeriod = String(body.period);
    if (body.forecast_steps != null) state.forecastSteps = String(body.forecast_steps);
    if (body.max_lags != null) state.acfMaxLags = String(body.max_lags);
  }
  if (op === 'kaplan_meier' || op === 'cox_proportional_hazards' || op === 'nelson_aalen') {
    if (typeof body.duration_column === 'string') state.durationCol = body.duration_column;
    if (typeof body.event_column === 'string') state.eventCol = body.event_column;
    if (typeof body.group_column === 'string') state.groupCol = body.group_column;
    const cov = body.covariates as string[] | undefined;
    if (cov?.length) state.independentCols = cov;
  }
  if (op === 'linear_mixed_model' || op === 'generalized_linear_mixed_model') {
    if (typeof body.dependent === 'string') state.depCol = body.dependent;
    const fixed = body.fixed_effects as string[] | undefined;
    if (fixed?.length) state.independentCols = fixed;
    if (typeof body.group_column === 'string') state.groupCol = body.group_column;
    const fam = body.family;
    if (fam === 'binomial' || fam === 'poisson') state.glmmFamily = fam;
  }
  if (op === 'multilevel_modelling') {
    if (typeof body.outcome_column === 'string') state.valueCol = body.outcome_column;
    const preds = body.level1_predictors as string[] | undefined;
    if (preds?.length) state.independentCols = preds;
    if (typeof body.level2_group_column === 'string') state.groupCol = body.level2_group_column;
  }
  if (op === 'latent_class_analysis') {
    const ind = body.indicators as string[] | undefined;
    if (ind?.length) state.selectedCols = ind;
    if (body.n_classes != null) state.pcaNComponents = String(body.n_classes);
  }
  if (op === 'confirmatory_factor_analysis') {
    const ind = body.indicators as string[] | undefined;
    if (ind?.length) state.selectedCols = ind;
    if (typeof body.model_spec === 'string') state.semModelSpec = body.model_spec;
  }
  if (op === 'structural_equation_modelling') {
    if (typeof body.model_spec === 'string') state.semModelSpec = body.model_spec;
    const cols = body.columns as string[] | undefined;
    if (cols?.length) state.selectedCols = cols;
  }
  return state;
}

/** One-line subtitle below the dialog title (spec v2.0 §2.1). */
export type AnalysisWizardMeta = {
  summary: string;
};

export const ANALYSIS_WIZARD_META: Record<AnalysisKey, AnalysisWizardMeta> = {
  descriptives: {
    summary: 'Summarize columns with counts, central tendency, spread, and extremes.',
  },
  correlation: {
    summary: 'Measure the strength and direction of relationships between numeric variables.',
  },
  ttest_independent: {
    summary: 'Compare the average of a numeric variable between two independent groups.',
  },
  anova_oneway: {
    summary: 'Test whether the average of a numeric variable differs across three or more groups.',
  },
  ttest_paired: {
    summary: 'Compare two related measurements from the same cases.',
  },
  mann_whitney_u: {
    summary: 'Compare two independent groups using ranks instead of means.',
  },
  kruskal_wallis: {
    summary: 'Compare three or more independent groups using ranks.',
  },
  wilcoxon_signed_rank: {
    summary: 'Compare two related measurements using ranks (nonparametric paired test).',
  },
  friedman: {
    summary: 'Compare three or more related measures on the same cases.',
  },
  kolmogorov_smirnov: {
    summary: 'Test normality of one variable or compare two distributions.',
  },
  reliability_cronbach: {
    summary: "Measure internal consistency of a multi-item scale (Cronbach's α).",
  },
  partial_correlation: {
    summary:
      'Correlation between two variables after removing linear effects of control variables.',
  },
  pca: {
    summary: 'Reduce many numeric variables to orthogonal components that explain variance.',
  },
  anova_twoway: {
    summary: 'Test main and interaction effects of two factors on a numeric outcome.',
  },
  anova_repeated: {
    summary: 'Test whether related measures differ across conditions on the same subjects.',
  },
  stepwise_regression: {
    summary: 'Automatically enter and remove predictors by significance to build a linear model.',
  },
  poisson_regression: {
    summary: 'Model a count outcome as a function of predictors (log link).',
  },
  cohens_kappa: {
    summary: 'Agreement between two categorical raters beyond chance.',
  },
  efa: {
    summary: 'Extract latent factors from correlated numeric items (ML extraction).',
  },
  discriminant_analysis: {
    summary: 'Find linear combinations of predictors that best separate group categories.',
  },
  cluster_analysis: {
    summary: 'Partition cases into groups based on numeric variable similarity.',
  },
  manova: {
    summary: 'Test whether group means differ simultaneously on two or more outcomes.',
  },
  ancova: {
    summary: 'Compare group means on an outcome while controlling for a numeric covariate.',
  },
  decision_tree: {
    summary: 'Classify a categorical outcome with a simple decision tree (train/test split).',
  },
  linear_regression: {
    summary: 'Predict or explain a continuous outcome from one or more predictors.',
  },
  logistic_regression: {
    summary: 'Model a binary outcome from one or more predictors.',
  },
  ttest_one_sample: {
    summary: 'Test whether a numeric variable differs from a value you specify.',
  },
  chi_square: {
    summary: 'Test whether two categorical variables are associated.',
  },
  shapiro_wilk: {
    summary: 'Test whether a numeric variable is normally distributed.',
  },
  sign_test: {
    summary: 'Nonparametric test on the direction of paired differences.',
  },
  probit_regression: {
    summary: 'Model a binary outcome with a probit link function.',
  },
  mcnemar: {
    summary: 'Test for change in paired categorical responses (2×2).',
  },
  negative_binomial_regression: {
    summary: 'Model overdispersed count outcomes with a negative binomial GLM.',
  },
  ordinal_regression: {
    summary: 'Model an ordered categorical outcome with cumulative logit link.',
  },
  median_test: {
    summary: 'Test whether group medians differ (chi-square on above/below grand median).',
  },
  runs_test: {
    summary: 'Test randomness of a sequence (too many or too few runs).',
  },
  jonckheere_terpstra: {
    summary: 'Test for ordered differences across a priori ordered groups.',
  },
  moses_test: {
    summary: 'Compare dispersion between two groups using extreme scores.',
  },
  cochrans_q: {
    summary: 'Test whether proportions differ across three or more related dichotomous variables.',
  },
  canonical_correlation: {
    summary: 'Find linear combinations of two variable sets with maximum correlation.',
  },
  multidimensional_scaling: {
    summary: 'Represent cases in low-dimensional space from variable dissimilarities.',
  },
  hotelling_t2: {
    summary: 'Compare two groups simultaneously on multiple dependent variables.',
  },
  lilliefors_ks: {
    summary:
      'K–S normality test with mean and SD estimated from the sample (Lilliefors correction).',
  },
  random_forest_classification: {
    summary:
      'Ensemble tree classifier with holdout accuracy, confusion matrix, ROC, and feature importance.',
  },
  random_forest_regression: {
    summary: 'Ensemble tree regressor with R², predicted-vs-actual plot, and feature importance.',
  },
  svm_classification: {
    summary: 'Support vector machine classifier with confusion matrix and ROC curve.',
  },
  gradient_boosting: {
    summary:
      'Gradient boosted trees (scikit-learn) for classification or regression with learning curve.',
  },
  neural_network_mlp: {
    summary: 'Multi-layer perceptron for classification or regression with training loss curve.',
  },
  dbscan: {
    summary: 'Density-based clustering — discover clusters and noise without specifying k.',
  },
  arima_sarima: {
    summary:
      'Fit ARIMA/SARIMA with automatic order selection (AIC) and forecast with confidence intervals.',
  },
  exponential_smoothing: {
    summary:
      'Holt-Winters exponential smoothing with seasonal period — forecast with confidence intervals.',
  },
  stl_decomposition: {
    summary: 'Decompose a series into trend, seasonal, and residual components (STL).',
  },
  stationarity_tests: {
    summary: 'Augmented Dickey-Fuller and KPSS stationarity tests with critical values.',
  },
  autocorrelation: {
    summary: 'Autocorrelation (ACF) and partial autocorrelation (PACF) diagnostic plots.',
  },
  kaplan_meier: {
    summary: 'Kaplan-Meier survival curves with optional grouping and log-rank test.',
  },
  cox_proportional_hazards: {
    summary: 'Cox proportional hazards model — coefficients, hazard ratios, and survival curve.',
  },
  nelson_aalen: {
    summary: 'Nelson-Aalen cumulative hazard estimator.',
  },
  linear_mixed_model: {
    summary: 'Linear mixed model with fixed effects and random intercepts by group.',
  },
  generalized_linear_mixed_model: {
    summary: 'GLMM with binomial or Poisson family and random intercepts.',
  },
  multilevel_modelling: {
    summary: 'Hierarchical linear model with ICC and group-level random effects.',
  },
  latent_class_analysis: {
    summary: 'Latent class analysis with class membership probabilities and profiles.',
  },
  confirmatory_factor_analysis: {
    summary: 'CFA with factor loadings, fit indices (CFI, RMSEA, SRMR), and path diagram.',
  },
  structural_equation_modelling: {
    summary: 'Full SEM with path coefficients, fit indices, and path diagram.',
  },
  fleiss_kappa: {
    summary: 'Inter-rater agreement for three or more raters on categorical ratings.',
  },
  weighted_kappa: {
    summary: 'Ordinal agreement between two raters with partial credit for near-misses.',
  },
  kendalls_w: {
    summary: 'Coefficient of concordance for agreement across multiple raters on rankings.',
  },
  fishers_exact: {
    summary: 'Exact test of independence for 2×2 tables when chi-square assumptions fail.',
  },
  odds_ratio: {
    summary: 'Measure of association for 2×2 tables — odds in one group vs another.',
  },
  relative_risk: {
    summary: 'Ratio of outcome probability in exposed vs unexposed groups.',
  },
  goodman_kruskal_gamma: {
    summary: 'Ordinal association based on concordant and discordant pairs.',
  },
  somers_d: {
    summary: 'Asymmetric ordinal association when direction of prediction matters.',
  },
  goodman_kruskal_lambda: {
    summary: 'Proportional reduction in error for nominal association.',
  },
  mantel_haenszel: {
    summary: 'Test for linear trend in proportions across ordered groups.',
  },
  cochran_armitage: {
    summary: 'Test for trend in binomial proportions across ordered categories.',
  },
  loglinear: {
    summary: 'Model relationships among categorical variables in multi-way tables.',
  },
  hierarchical_regression: {
    summary: 'Enter predictors in theory-driven blocks and assess incremental R².',
  },
  anova_mixed: {
    summary: 'Factorial design with between-subjects and within-subjects factors.',
  },
  anova_threeway: {
    summary: 'Three-way between-subjects ANOVA with all interactions.',
  },
  moderation_analysis: {
    summary: 'Test whether X→Y relationship differs across levels of moderator M.',
  },
};

export type DescriptiveStatKey =
  | 'mean'
  | 'median'
  | 'std_dev'
  | 'variance'
  | 'range'
  | 'min'
  | 'max'
  | 'skewness'
  | 'kurtosis'
  | 'sem';

export const DEFAULT_DESCRIPTIVE_STATS: Record<DescriptiveStatKey, boolean> = {
  mean: true,
  median: true,
  std_dev: true,
  variance: false,
  range: true,
  min: true,
  max: true,
  skewness: false,
  kurtosis: false,
  sem: false,
};

export type AnovaEffectSizeKey = 'none' | 'eta_squared' | 'partial_eta_squared' | 'omega_squared';
export type AnovaHomogeneityKey = 'levene' | 'brown_forsythe' | 'none';
export type AnovaOutputChartKey = 'boxplot' | 'means_plot' | 'none';
export type RegressionMethodKey = 'enter' | 'stepwise' | 'backward' | 'forward';
export type RegressionResidualPlotsKey = 'none' | 'residuals_fitted' | 'qq' | 'both';
export type CorrelationSignificanceKey = 'two_tailed' | 'one_tailed';
