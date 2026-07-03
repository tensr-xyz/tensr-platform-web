import type { AnalysisKey } from '@/lib/analysis-definitions';

/** Researcher-facing tooltip copy (spec v2.0 §6) — use verbatim in the ⓘ popover. */
export type AnalysisWizardTooltip = {
  useWhen: string[];
  assumptions: string[];
  output: string[];
};

export const ANALYSIS_WIZARD_TOOLTIPS: Partial<Record<AnalysisKey, AnalysisWizardTooltip>> = {
  descriptives: {
    useWhen: [
      'You want a numerical summary of one or more columns before doing any further analysis.',
      'You are exploring a new dataset and need to understand the scale, spread, and shape of your variables.',
      'You need to check for extreme values or unusual distributions before modelling.',
    ],
    assumptions: [
      'None. Descriptive statistics make no distributional assumptions.',
      'Results reflect the 250-row preview sample, not the full dataset.',
    ],
    output: [
      'Count (non-missing cases), mean, standard deviation, minimum, maximum for each numeric column.',
      'Mode and frequency count for categorical columns.',
      'Optional: median, variance, skewness, kurtosis, standard error of mean.',
    ],
  },
  correlation: {
    useWhen: [
      'You want to measure the strength and direction of the relationship between two or more numeric variables.',
      'You are exploring associations before running regression.',
      'Use Spearman or Kendall when variables are ordinal or not normally distributed.',
    ],
    assumptions: [
      'Both variables are continuous and numeric (Pearson).',
      'The relationship between variables is linear (Pearson).',
      'Both variables are approximately normally distributed (Pearson).',
      "No extreme outliers (these strongly affect Pearson's r).",
    ],
    output: [
      'Correlation matrix showing r (or ρ / τ) for each pair of variables.',
      'p-value for each correlation.',
      'Sample size (N) for each pair.',
      'Asterisks marking statistically significant correlations (when flagging is enabled).',
    ],
  },
  ttest_independent: {
    useWhen: [
      'You want to compare the average of a numeric variable between two independent groups.',
      'The two groups are entirely separate — no person or case appears in both groups.',
    ],
    assumptions: [
      'The outcome is continuous and numeric.',
      'The two groups are independent (use paired t-test for repeated measures).',
      'The outcome is approximately normally distributed within each group, or both groups have more than 30 cases.',
      "Variances may differ between groups (Levene's test checks this automatically).",
    ],
    output: [
      'Group means, standard deviations, and sample sizes.',
      "Levene's test result (whether variances are equal).",
      't-statistic, degrees of freedom, p-value, and confidence interval for the mean difference.',
      'Results reported for equal and unequal variance assumptions where applicable.',
    ],
  },
  ttest_paired: {
    useWhen: [
      'You have two measurements from the same cases — for example, a before and after measure.',
      'You want to test whether the average difference between the two measurements differs from zero.',
    ],
    assumptions: [
      'Both variables are continuous and numeric.',
      'The differences between pairs are approximately normally distributed.',
      'Each row represents the same case or a matched pair.',
    ],
    output: [
      'Mean and standard deviation of the differences.',
      't-statistic, degrees of freedom, p-value, and confidence interval for the mean difference.',
      'Correlation between the two variables.',
    ],
  },
  ttest_one_sample: {
    useWhen: [
      'You want to test whether the average of a single numeric variable differs from a specific value you specify.',
      'Typical uses: testing against a benchmark, target, or zero.',
    ],
    assumptions: [
      'The variable is continuous and numeric.',
      'Values are approximately normally distributed, or the sample is large enough (n > 30).',
      'Cases are independent of each other.',
    ],
    output: [
      'Sample mean and standard deviation.',
      't-statistic, degrees of freedom, and p-value.',
      'Mean difference from the test value, with confidence interval.',
    ],
  },
  anova_oneway: {
    useWhen: [
      'You want to test whether the average of a numeric variable differs across three or more groups.',
      'Your groups are defined by a single categorical variable.',
      'Use this before assuming any specific pair of groups differs.',
      'If you only have two groups, use an independent samples t-test instead.',
    ],
    assumptions: [
      'The outcome is continuous and numeric.',
      'Groups are independent — no case appears in more than one group.',
      'The outcome is approximately normally distributed within each group.',
      "Variances are roughly equal across groups (check with Levene's test).",
    ],
    output: [
      'F-statistic, degrees of freedom, and p-value — whether any group mean differs significantly.',
      'Effect size — how much variance in the outcome is explained by group membership.',
      'Group means table with standard deviations and sample sizes (when descriptives enabled).',
      'Post-hoc pairwise comparisons table (when a post-hoc method is selected).',
      "Levene's test result — whether variances are equal across groups.",
    ],
  },
  mann_whitney_u: {
    useWhen: [
      'You want to compare a numeric variable between two independent groups and normality is doubtful.',
      'The nonparametric alternative to the independent samples t-test.',
    ],
    assumptions: [
      'The test variable is at least ordinal.',
      'The two groups are independent.',
      'The test assesses whether the distributions of the two groups differ.',
    ],
    output: [
      'Mann-Whitney U statistic and p-value.',
      'Wilcoxon W statistic.',
      'Z-approximation for larger samples.',
    ],
  },
  kruskal_wallis: {
    useWhen: [
      'You want to compare a numeric variable across three or more independent groups without assuming normality.',
      'The nonparametric alternative to one-way ANOVA.',
    ],
    assumptions: [
      'The test variable is at least ordinal.',
      'Groups are independent.',
      'The test assesses whether the distributions of the groups differ.',
    ],
    output: [
      'Kruskal-Wallis H statistic, degrees of freedom, and p-value.',
      'Mean ranks for each group.',
      'Post-hoc pairwise comparisons (when enabled).',
    ],
  },
  wilcoxon_signed_rank: {
    useWhen: [
      'You have two related numeric measurements and normality of differences is doubtful.',
      'Nonparametric alternative to the paired-samples t-test.',
    ],
    assumptions: [
      'Pairs are matched (same case measured twice).',
      'The difference scores are symmetrically distributed (for inference).',
    ],
    output: ['Wilcoxon W statistic and p-value.', 'Median difference between measures.'],
  },
  friedman: {
    useWhen: [
      'You have three or more related measures on the same cases.',
      'Nonparametric alternative to repeated-measures ANOVA.',
    ],
    assumptions: ['Measures are at least ordinal.', 'Same cases across all measures.'],
    output: ['χ² statistic, degrees of freedom, and p-value.', 'Mean by measure.'],
  },
  kolmogorov_smirnov: {
    useWhen: [
      'Compare whether two numeric samples come from the same distribution.',
      'Or test whether one variable looks normally distributed (Shapiro–Wilk).',
    ],
    assumptions: ['Values are numeric.', 'Independence between cases (two-sample mode).'],
    output: ['Test statistic and p-value.', 'Sample sizes for each group.'],
  },
  reliability_cronbach: {
    useWhen: [
      'You have a multi-item survey scale and want internal consistency.',
      'Higher α suggests items measure the same latent construct.',
    ],
    assumptions: [
      'Items are numeric and on a similar scale.',
      'Tau-equivalent / unidimensional scale.',
    ],
    output: ["Cronbach's α.", 'Per-item means and item–total correlations.'],
  },
  partial_correlation: {
    useWhen: [
      'You want the correlation between two variables after accounting for other numeric variables.',
    ],
    assumptions: [
      'Linear relationships among all variables.',
      'Adequate sample size relative to number of controls.',
    ],
    output: ['Partial correlation coefficient and p-value.'],
  },
  pca: {
    useWhen: ['You have many correlated numeric variables and want fewer orthogonal components.'],
    assumptions: [
      'Variables are numeric.',
      'Cases are independent.',
      'Linear structure in the data helps interpretation.',
    ],
    output: ['Eigenvalues, variance explained, and component loadings.'],
  },
  anova_twoway: {
    useWhen: ['You have two categorical factors and one numeric outcome.'],
    assumptions: ['Independent observations.', 'Approximately normal residuals within cells.'],
    output: ['Type II ANOVA table with main effects and interaction.'],
  },
  anova_repeated: {
    useWhen: ['The same subjects are measured under multiple conditions (wide format).'],
    assumptions: [
      'Sphericity (Mauchly) for classical inference.',
      'Same subjects across measures.',
    ],
    output: ['Within-subjects ANOVA table.'],
  },
  stepwise_regression: {
    useWhen: ['You want a parsimonious linear model built by automatic predictor entry/removal.'],
    assumptions: [
      'Same as linear regression.',
      'Selection can inflate Type I error — treat as exploratory.',
    ],
    output: ['Final model coefficients and fit statistics.', 'List of predictors entered.'],
  },
  poisson_regression: {
    useWhen: ['Your outcome is a non-negative count (events, tallies).'],
    assumptions: [
      'Independent counts.',
      'Overdispersion may require negative binomial extensions.',
    ],
    output: ['Coefficients, incidence rate ratios, AIC, and deviance.'],
  },
  cohens_kappa: {
    useWhen: ['Two raters classified the same cases and you need agreement beyond chance.'],
    assumptions: ['Same cases rated by both columns.', 'Categories are nominal.'],
    output: ["Cohen's κ, p-value, and contingency table."],
  },
  linear_regression: {
    useWhen: [
      'You want to predict or explain a continuous numeric outcome from one or more predictor variables.',
      'You want to quantify relationships while controlling for other predictors.',
      'You want to understand how much variance each predictor accounts for.',
    ],
    assumptions: [
      'The outcome is continuous and numeric.',
      'The relationship between each predictor and the outcome is linear.',
      'Residuals are approximately normally distributed.',
      'Residuals have constant variance across predictor levels.',
      'Predictors are not highly correlated with each other.',
      'Cases are independent.',
    ],
    output: [
      'Model summary: R², adjusted R², standard error of the estimate.',
      'ANOVA table for the overall model (F-statistic and p-value).',
      'Coefficients table with standard errors, t-statistics, p-values, and confidence intervals.',
      'Collinearity statistics (VIF and tolerance) when enabled.',
      'Residual plots when selected.',
    ],
  },
  logistic_regression: {
    useWhen: [
      'Your outcome has exactly two categories — yes/no, pass/fail, present/absent, 0/1.',
      'You want to predict the probability of one outcome category from predictors.',
      'You want to see which predictors are associated with the outcome while controlling for others.',
    ],
    assumptions: [
      'The outcome is binary.',
      'Cases are independent.',
      'No extreme multicollinearity among predictors.',
      'At least 10 events per predictor is a common rule of thumb.',
      'Normality of predictors is not required.',
    ],
    output: [
      'Coefficients table: B, Wald statistic, p-value, and Exp(B) (odds ratio) with confidence intervals.',
      'Model fit statistics: -2 log likelihood, Cox & Snell R², Nagelkerke R².',
      'Classification table at the specified cutoff.',
      'Hosmer–Lemeshow test when enabled.',
    ],
  },
  chi_square: {
    useWhen: [
      'You want to examine the relationship between two categorical variables.',
      'You need to see how cases distribute across combinations of two grouping variables.',
      'You want to test whether two categorical variables are statistically independent.',
    ],
    assumptions: [
      'Both variables are categorical.',
      'For chi-square: expected count ≥ 5 in at least 80% of cells.',
      'No cell has an expected count below 1.',
      'Results are based on the 250-row preview sample.',
    ],
    output: [
      'Contingency table showing counts.',
      'Chi-square test of independence with p-value.',
      "Effect size measures (Cramér's V, phi) when applicable.",
    ],
  },
  efa: {
    useWhen: ['You suspect a smaller set of latent factors underlies many correlated items.'],
    assumptions: ['Variables are numeric.', 'Adequate sample size relative to number of items.'],
    output: ['Factor loadings and communalities.'],
  },
  discriminant_analysis: {
    useWhen: ['You have a categorical group and want to see which predictors separate the groups.'],
    assumptions: ['Predictors are numeric.', 'Groups are mutually exclusive.'],
    output: ['Classification accuracy and discriminant coefficients.'],
  },
  cluster_analysis: {
    useWhen: ['You want to group similar cases without a predefined outcome.'],
    assumptions: ['Clustering variables are numeric.', 'Clusters are interpreted post hoc.'],
    output: ['Cluster sizes and (for k-means) centroids.'],
  },
  manova: {
    useWhen: ['You have two or more related outcomes and want to test group differences jointly.'],
    assumptions: ['Outcomes are numeric.', 'Multivariate normality and homogeneity of covariance.'],
    output: ['Multivariate test statistics and p-values.'],
  },
  ancova: {
    useWhen: ['You compare group means on an outcome while adjusting for a numeric covariate.'],
    assumptions: [
      'Parallel slopes across groups when testing the group effect (unless interaction included).',
    ],
    output: ['Type II ANCOVA table and model R².'],
  },
  decision_tree: {
    useWhen: ['You want a simple, interpretable classifier for a categorical outcome.'],
    assumptions: [
      'Outcome has two or more categories.',
      'Holdout accuracy is indicative but may overfit small samples.',
    ],
    output: ['Train/test accuracy and variable importances.'],
  },
  shapiro_wilk: {
    useWhen: ['You want to test whether a numeric variable is normally distributed.'],
    assumptions: [
      'Variable is numeric.',
      'Sample size is adequate for Shapiro–Wilk (typically n ≥ 3).',
    ],
    output: ['W statistic and p-value for normality.'],
  },
  sign_test: {
    useWhen: ['You want a nonparametric test on the direction of paired differences.'],
    assumptions: ['Paired numeric measurements on the same cases.'],
    output: ['Counts of positive vs negative differences and p-value.'],
  },
  probit_regression: {
    useWhen: ['You want to model a binary outcome with a probit link.'],
    assumptions: ['Outcome is binary.', 'Independent variables are numeric or coded.'],
    output: ['Probit coefficients, standard errors, and p-values.'],
  },
  mcnemar: {
    useWhen: ['You want to test change in paired categorical responses (2×2 table).'],
    assumptions: ['Two related categorical variables with two levels each.'],
    output: ['Discordant pair counts and McNemar p-value.'],
  },
  negative_binomial_regression: {
    useWhen: ['You want to model count data with overdispersion relative to Poisson.'],
    assumptions: ['Outcome is a non-negative count.', 'Predictors are numeric or coded.'],
    output: ['Coefficients, incidence rate ratios, and model fit statistics.'],
  },
  ordinal_regression: {
    useWhen: ['You want to model an ordered categorical outcome.'],
    assumptions: [
      'Outcome categories have a meaningful order.',
      'Predictors are numeric or coded.',
    ],
    output: ['Ordinal logit coefficients and threshold estimates.'],
  },
  median_test: {
    useWhen: ['You want to compare group medians without assuming normality.'],
    assumptions: ['Outcome is numeric.', 'Groups are independent.'],
    output: ['Chi-square statistic comparing above/below grand median.'],
  },
  runs_test: {
    useWhen: ['You want to test whether a numeric sequence is random.'],
    assumptions: ['Observations are ordered.', 'Values are numeric.'],
    output: ['Number of runs, Z statistic, and p-value.'],
  },
  jonckheere_terpstra: {
    useWhen: ['You have ordered groups and want to test for a monotonic trend.'],
    assumptions: ['Groups have a priori order.', 'Outcome is numeric.'],
    output: ['J statistic, Z, and one-tailed p-value for trend.'],
  },
  moses_test: {
    useWhen: ['You want to compare dispersion between two independent groups.'],
    assumptions: ['Exactly two independent groups.', 'Outcome is numeric.'],
    output: ['Range statistics after trimming extreme scores.'],
  },
  cochrans_q: {
    useWhen: ['You have three or more related dichotomous variables on the same cases.'],
    assumptions: [
      'Variables are binary (0/1 or yes/no).',
      'Same subjects measured on each variable.',
    ],
    output: ["Cochran's Q statistic and p-value."],
  },
  canonical_correlation: {
    useWhen: ['You want to relate two sets of numeric variables via linear combinations.'],
    assumptions: [
      'Variables in both sets are numeric.',
      'Adequate sample size relative to number of variables.',
    ],
    output: ['Canonical correlations for each function.'],
  },
  multidimensional_scaling: {
    useWhen: ['You want a low-dimensional map of cases based on variable dissimilarities.'],
    assumptions: ['Variables are numeric.', 'Euclidean distance is meaningful.'],
    output: ['MDS coordinates and stress value.'],
  },
  hotelling_t2: {
    useWhen: ['You want to compare two groups on two or more outcomes simultaneously.'],
    assumptions: ['Two groups.', 'Outcomes are numeric.', 'Multivariate normality (approximate).'],
    output: ["Hotelling's T², F statistic, and p-value."],
  },
  lilliefors_ks: {
    useWhen: ['You want a normality test when mean and SD are estimated from the data.'],
    assumptions: ['Variable is numeric.', 'Lilliefors correction for estimated parameters.'],
    output: ['K–S D statistic and p-value.'],
  },
  random_forest_classification: {
    useWhen: ['You want a robust ensemble classifier with feature importance and holdout metrics.'],
    assumptions: [
      'Target is categorical.',
      'Features are numeric.',
      'Enough rows for train/test split.',
    ],
    output: ['Accuracy, confusion matrix, ROC (binary), feature importance chart.'],
  },
  random_forest_regression: {
    useWhen: ['You want to predict a numeric outcome with an ensemble of trees.'],
    assumptions: ['Target and features are numeric.'],
    output: ['R², RMSE, predicted-vs-actual scatter, feature importance.'],
  },
  svm_classification: {
    useWhen: ['You want a maximum-margin classifier for categorical outcomes.'],
    assumptions: ['Target is categorical.', 'Features are numeric.'],
    output: ['Confusion matrix and ROC curve on holdout data.'],
  },
  gradient_boosting: {
    useWhen: ['You want boosted trees for classification or regression (scikit-learn).'],
    assumptions: ['Appropriate target type for the selected mode.', 'Features are numeric.'],
    output: ['Holdout metrics, feature importance, learning curve.'],
  },
  neural_network_mlp: {
    useWhen: ['You want a feed-forward neural network (MLP) for classification or regression.'],
    assumptions: ['Features are numeric.', 'Training may need sufficient sample size.'],
    output: ['Loss curve, confusion matrix or predicted-vs-actual plot.'],
  },
  dbscan: {
    useWhen: ['You want density-based clusters without specifying the number of clusters.'],
    assumptions: [
      'Features are numeric.',
      'Distance scale depends on epsilon and standardization.',
    ],
    output: ['Cluster sizes, noise count, 2-D cluster scatter.'],
  },
  arima_sarima: {
    useWhen: ['You want to forecast a numeric series with automatic ARIMA/SARIMA order selection.'],
    assumptions: [
      'Target is numeric.',
      'Optional date column orders observations.',
      'Enough history for seasonal models.',
    ],
    output: ['Selected order, forecast table with 95% CI, forecast chart.'],
  },
  exponential_smoothing: {
    useWhen: ['You want Holt-Winters smoothing with a seasonal period.'],
    assumptions: ['Target is numeric.', 'Seasonal period matches the data (e.g. 12 for monthly).'],
    output: ['Forecast table with approximate CI, fitted vs forecast chart.'],
  },
  stl_decomposition: {
    useWhen: ['You want to split a series into trend, seasonal, and residual components.'],
    assumptions: ['Target is numeric.', 'Seasonal period is specified.'],
    output: ['Trend, seasonal, and residual component charts.'],
  },
  stationarity_tests: {
    useWhen: ['You need both ADF and KPSS tests for stationarity.'],
    assumptions: ['Target is numeric time-ordered series.'],
    output: ['ADF and KPSS statistics, p-values, and critical values tables.'],
  },
  autocorrelation: {
    useWhen: ['You want ACF and PACF plots to guide ARIMA order choice.'],
    assumptions: ['Target is numeric.'],
    output: ['ACF and PACF bar charts.'],
  },
  kaplan_meier: {
    useWhen: ['You want survival curves from duration and event indicators.'],
    assumptions: ['Duration is positive numeric.', 'Event is 0/1 (censored vs event).'],
    output: ['Survival curve with confidence bands; log-rank p-value if grouped.'],
  },
  cox_proportional_hazards: {
    useWhen: ['You want to model hazard as a function of covariates.'],
    assumptions: ['Proportional hazards (approximate).', 'Covariates are numeric.'],
    output: ['Coefficient table, hazard ratios, baseline survival curve.'],
  },
  nelson_aalen: {
    useWhen: ['You want a non-parametric cumulative hazard estimate.'],
    assumptions: ['Duration and event columns as for Kaplan-Meier.'],
    output: ['Cumulative hazard plot.'],
  },
  linear_mixed_model: {
    useWhen: ['Repeated measures or clustered data with a continuous outcome.'],
    assumptions: [
      'Grouping variable identifies clusters.',
      'Fixed effects are numeric predictors.',
    ],
    output: ['Fixed-effect coefficients, random-effects summary, fitted vs residual chart.'],
  },
  generalized_linear_mixed_model: {
    useWhen: ['Clustered binary or count outcomes.'],
    assumptions: [
      'Binomial: binary dependent; Poisson: non-negative counts.',
      'Random intercept by group.',
    ],
    output: ['Coefficient table, random effects, fitted vs residual chart.'],
  },
  multilevel_modelling: {
    useWhen: ['Nested data with level-1 predictors and level-2 groups.'],
    assumptions: ['Outcome is numeric.', 'ICC interpretable from random intercept variance.'],
    output: ['ICC, fixed effects table, random intercept chart.'],
  },
  latent_class_analysis: {
    useWhen: ['You suspect latent subgroups from categorical or binary indicators.'],
    assumptions: ['Indicators are categorical or binary.', 'Choose a plausible number of classes.'],
    output: ['Class membership probabilities and profile bar chart per class.'],
  },
  confirmatory_factor_analysis: {
    useWhen: ['You have a hypothesized factor structure for observed indicators.'],
    assumptions: ['Indicators are numeric.', 'Model spec uses semopy syntax (e.g. F1 =~ x1 + x2).'],
    output: ['Factor loadings, CFI/RMSEA/SRMR fit indices, path diagram.'],
  },
  structural_equation_modelling: {
    useWhen: ['You want to test latent and observed relationships in one model.'],
    assumptions: ['Full semopy model spec with measurement and structural paths.'],
    output: ['Path coefficients, fit indices, SEM path diagram.'],
  },
};
