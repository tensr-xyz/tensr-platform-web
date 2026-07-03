/**
 * Chat → menu-action resolver.
 *
 * Maps a free-form chat message to the same dispatchable actions used by the
 * ⌘K palette: open the analysis setup modal, open a transform/data dialog by
 * menu name, run a direct mutation against the active dataset/tab, or surface
 * an unavailable feature.
 */

import { MENU_ITEMS } from '@/configs/analysis-config';
import {
  getAnalysisOpForMenuName,
  isDialogMenuItem,
} from '@/configs/analysis-config/menu-registry';
import type { AnalysisKey } from '@/lib/analysis-definitions';
import { shouldRouteToInlineChart } from '@/lib/chart-intent';

export type FilterOperator = 'equals' | 'contains' | 'greaterThan' | 'lessThan';

export type ChatAction =
  | { kind: 'analysis'; op: AnalysisKey; menuName: string }
  | { kind: 'dialog'; menuName: string }
  | { kind: 'unavailable'; menuName: string }
  | { kind: 'rename_column'; from: string; to: string }
  | { kind: 'delete_column'; column: string }
  | { kind: 'sort_column'; column: string; direction: 'asc' | 'desc' }
  | { kind: 'filter_column'; column: string; operator: FilterOperator; value: string }
  | { kind: 'hide_column'; column: string }
  | { kind: 'show_hidden_columns' }
  | { kind: 'clear_filters' }
  | { kind: 'clear_sort' }
  | { kind: 'group_by'; column: string }
  | { kind: 'aggregate_by'; column: string }
  | { kind: 'chat' };

/** Every label that lives in MENU_ITEMS (lowercase → original casing). */
function collectMenuLabels(): Map<string, string> {
  const out = new Map<string, string>();
  for (const cat of Object.values(MENU_ITEMS)) {
    const sections = (cat as { sections?: Record<string, readonly string[]> }).sections;
    if (!sections) continue;
    for (const items of Object.values(sections)) {
      for (const label of items) {
        out.set(label.toLowerCase(), label);
      }
    }
  }
  return out;
}

const LABELS_BY_LOWER = collectMenuLabels();

/** Hand-tuned synonyms → exact menu label. */
const SYNONYMS: Record<string, string> = {
  // analyses
  't test': 'Independent-Samples T Test',
  't-test': 'Independent-Samples T Test',
  ttest: 'Independent-Samples T Test',
  'independent samples': 'Independent-Samples T Test',
  'independent t-test': 'Independent-Samples T Test',
  'one sample t test': 'One-Sample T Test',
  'one-sample t-test': 'One-Sample T Test',
  'paired t test': 'Paired-Samples T Test',
  'paired t-test': 'Paired-Samples T Test',
  'paired samples t-test': 'Paired-Samples T Test',
  'paired samples t test': 'Paired-Samples T Test',
  'repeated measures t-test': 'Paired-Samples T Test',
  'repeated measures t test': 'Paired-Samples T Test',
  anova: 'One-Way ANOVA',
  'one way anova': 'One-Way ANOVA',
  'one-way anova': 'One-Way ANOVA',
  descriptives: 'Descriptives',
  'descriptive statistics': 'Descriptives',
  frequencies: 'Descriptives',
  crosstab: 'Crosstabs',
  'cross tab': 'Crosstabs',
  'chi squared': 'Crosstabs',
  'chi-square': 'Crosstabs',
  'chi square': 'Crosstabs',
  correlation: 'Bivariate Correlations',
  correlations: 'Bivariate Correlations',
  correlate: 'Bivariate Correlations',
  pearson: 'Bivariate Correlations',
  spearman: 'Bivariate Correlations',
  bivariate: 'Bivariate Correlations',
  regression: 'Linear Regression',
  'linear regression': 'Linear Regression',
  predicting: 'Linear Regression',
  'predict ': 'Linear Regression',
  'multiple regression': 'Multiple Regression',
  'logistic regression': 'Logistic Regression',
  'mann whitney': 'Mann-Whitney U',
  'mann-whitney': 'Mann-Whitney U',
  kruskal: 'Kruskal-Wallis H',
  'kruskal wallis': 'Kruskal-Wallis H',
  wilcoxon: 'Wilcoxon Signed-Rank',
  'wilcoxon signed rank': 'Wilcoxon Signed-Rank',
  friedman: 'Friedman Test',
  'kolmogorov smirnov': 'Kolmogorov-Smirnov',
  'k-s test': 'Kolmogorov-Smirnov',
  'ks test': 'Kolmogorov-Smirnov',
  'two sample ks': 'Kolmogorov-Smirnov',
  normality: 'Kolmogorov-Smirnov',
  cronbach: 'Reliability Analysis',
  "cronbach's alpha": 'Reliability Analysis',
  'reliability analysis': 'Reliability Analysis',
  'internal consistency': 'Reliability Analysis',
  'scale reliability': 'Reliability Analysis',
  reliability: 'Reliability Analysis',
  pca: 'Principal Component Analysis',
  'principal component': 'Principal Component Analysis',
  'partial correlation': 'Partial Correlation',
  'two-way anova': 'Two-Way ANOVA',
  'two way anova': 'Two-Way ANOVA',
  'factorial anova': 'Three-Way ANOVA',
  'fleiss kappa': "Fleiss' Kappa",
  'multi-rater agreement': "Fleiss' Kappa",
  'weighted kappa': 'Weighted Kappa',
  'kendall w': "Kendall's W",
  "kendall's w": "Kendall's W",
  'kendalls w': "Kendall's W",
  'coefficient of concordance': "Kendall's W",
  concordance: "Kendall's W",
  'fisher exact': "Fisher's Exact Test",
  "fisher's exact": "Fisher's Exact Test",
  'exact test': "Fisher's Exact Test",
  'odds ratio': 'Odds Ratio',
  'relative risk': 'Relative Risk',
  'risk ratio': 'Relative Risk',
  gamma: 'Goodman-Kruskal Gamma',
  'somers d': "Somers' D",
  somers: "Somers' D",
  'lambda association': 'Goodman-Kruskal Lambda',
  'mantel haenszel': 'Mantel-Haenszel Trend Test',
  'cochran armitage': 'Cochran-Armitage Trend Test',
  'trend test': 'Mantel-Haenszel Trend Test',
  loglinear: 'Loglinear Analysis',
  'log linear': 'Loglinear Analysis',
  'hierarchical regression': 'Hierarchical Multiple Regression',
  'hierarchical multiple regression': 'Hierarchical Multiple Regression',
  'block regression': 'Hierarchical Multiple Regression',
  'mixed anova': 'Mixed ANOVA',
  'mixed design': 'Mixed ANOVA',
  'between within': 'Mixed ANOVA',
  'three way anova': 'Three-Way ANOVA',
  'three-way anova': 'Three-Way ANOVA',
  moderation: 'Moderation Analysis',
  moderator: 'Moderation Analysis',
  'interaction effect': 'Moderation Analysis',
  'repeated measures': 'Repeated Measures ANOVA',
  'repeated measures anova': 'Repeated Measures ANOVA',
  'within subjects anova': 'Repeated Measures ANOVA',
  'within-subjects anova': 'Repeated Measures ANOVA',
  'rm anova': 'Repeated Measures ANOVA',
  arima: 'ARIMA / SARIMA',
  sarima: 'ARIMA / SARIMA',
  forecast: 'ARIMA / SARIMA',
  autoregressive: 'ARIMA / SARIMA',
  'exponential smoothing': 'Exponential Smoothing (Holt-Winters)',
  'holt winters': 'Exponential Smoothing (Holt-Winters)',
  'holt-winters': 'Exponential Smoothing (Holt-Winters)',
  ets: 'Exponential Smoothing (Holt-Winters)',
  'stl decomposition': 'Seasonal Decomposition (STL)',
  'seasonal decomposition': 'Seasonal Decomposition (STL)',
  'trend decomposition': 'Seasonal Decomposition (STL)',
  stl: 'Seasonal Decomposition (STL)',
  stationarity: 'Stationarity Tests',
  'stationarity tests': 'Stationarity Tests',
  'adf test': 'Stationarity Tests',
  'kpss test': 'Stationarity Tests',
  'unit root': 'Stationarity Tests',
  autocorrelation: 'Autocorrelation (ACF / PACF)',
  acf: 'Autocorrelation (ACF / PACF)',
  pacf: 'Autocorrelation (ACF / PACF)',
  'serial correlation': 'Autocorrelation (ACF / PACF)',
  hotelling: "Hotelling's T²",
  'hotelling t2': "Hotelling's T²",
  "hotelling's t²": "Hotelling's T²",
  'multivariate t-test': "Hotelling's T²",
  'multivariate t test': "Hotelling's T²",
  stepwise: 'Stepwise Regression',
  'stepwise regression': 'Stepwise Regression',
  poisson: 'Poisson Regression',
  'ordinal regression': 'Ordinal Regression',
  'ordered logistic': 'Ordinal Regression',
  'proportional odds': 'Ordinal Regression',
  kappa: "Cohen's Kappa",
  "cohen's kappa": "Cohen's Kappa",
  'cohens kappa': "Cohen's Kappa",
  'inter-rater': "Cohen's Kappa",
  efa: 'Exploratory Factor Analysis',
  'factor analysis': 'Exploratory Factor Analysis',
  'exploratory factor': 'Exploratory Factor Analysis',
  cluster: 'Cluster Analysis',
  'cluster analysis': 'Cluster Analysis',
  'k-means': 'Cluster Analysis',
  kmeans: 'Cluster Analysis',
  clustering: 'Cluster Analysis',
  discriminant: 'Discriminant Analysis',
  'discriminant analysis': 'Discriminant Analysis',
  lda: 'Discriminant Analysis',
  'linear discriminant': 'Discriminant Analysis',
  manova: 'Multivariate ANOVA',
  ancova: 'ANCOVA',
  'decision tree': 'Decision Tree Classification',
  'classification tree': 'Decision Tree Classification',
  cart: 'Decision Tree Classification',
  shapiro: 'Shapiro–Wilk Test',
  'shapiro wilk': 'Shapiro–Wilk Test',
  'sign test': 'Sign Test',
  'paired sign test': 'Sign Test',
  probit: 'Probit Regression',
  mcnemar: 'McNemar Test',
  'mcnemar test': 'McNemar Test',
  'paired chi-square': 'McNemar Test',
  'paired chi square': 'McNemar Test',
  'structural equation model': 'Structural Equation Modelling (SEM)',
  'structural equation modelling': 'Structural Equation Modelling (SEM)',
  'sem model': 'Structural Equation Modelling (SEM)',
  'path model': 'Structural Equation Modelling (SEM)',
  'lag cases': 'Lag Cases',
  'lead cases': 'Lead Cases',

  // data
  import: 'Import Data',
  'import data': 'Import Data',
  'load data': 'Import Data',
  'open file': 'Import Data',
  export: 'Export Data',
  'export data': 'Export Data',
  'download data': 'Export Data',
  'save as csv': 'Export Data',
  'save as json': 'Export Data',
  merge: 'Merge Datasets',
  'merge datasets': 'Merge Datasets',
  'join datasets': 'Merge Datasets',
  'find duplicates': 'Find Duplicates',
  'duplicate rows': 'Find Duplicates',
  missing: 'Handle Missing Data',
  'missing data': 'Handle Missing Data',
  'handle missing': 'Handle Missing Data',
  'replace missing': 'Replace Missing Values',
  standardize: 'Standardize Variables',
  standardise: 'Standardize Variables',
  'z score': 'Standardize Variables',
  'z-score': 'Standardize Variables',
  bin: 'Visual Binning',
  'bin variable': 'Visual Binning',
  discretize: 'Visual Binning',
  'data quality': 'Data Quality Report',
  'quality report': 'Data Quality Report',

  // transforms
  'compute variable': 'Compute Variable',
  'new variable': 'Compute Variable',
  'create variable': 'Compute Variable',
  'count values': 'Count Values',
  'shift values': 'Shift Values',
  recode: 'Recode Variables',
  rank: 'Rank Cases',
  sample: 'Sample Data',
  aggregate: 'Aggregate Data',
  reshape: 'Reshape Data',
  transpose: 'Transpose Data',
};

/** Analysis synonyms checked before spreadsheet filter/sort parsing (avoids mis-routing). */
const PRIORITY_ANALYSIS_SYNONYMS: Record<string, string> = {
  'structural equation model': 'Structural Equation Modelling (SEM)',
  'structural equation': 'Structural Equation Modelling (SEM)',
  'sem model': 'Structural Equation Modelling (SEM)',
  'path model': 'Structural Equation Modelling (SEM)',
  'latent variable': 'Structural Equation Modelling (SEM)',
  'measured by': 'Structural Equation Modelling (SEM)',
  'moderation analysis': 'Moderation Analysis',
  moderation: 'Moderation Analysis',
  moderator: 'Moderation Analysis',
  'interaction effect': 'Moderation Analysis',
  "kendall's w": "Kendall's W",
  'kendalls w': "Kendall's W",
  'coefficient of concordance': "Kendall's W",
};

function tryPriorityAnalysisAction(message: string): ChatAction | null {
  const lower = message.toLowerCase();
  const entries = Object.entries(PRIORITY_ANALYSIS_SYNONYMS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [key, label] of entries) {
    if (!lower.includes(key)) continue;
    const op = getAnalysisOpForMenuName(label);
    if (op) return { kind: 'analysis', op, menuName: label };
  }
  return null;
}

/** Lightweight intent extraction for structured commands like "rename X to Y",
 * "sort by X desc", "filter X > 10", "hide column X". */
function tryStructuredColumnEdit(message: string): ChatAction | null {
  const trimmed = message.replace(/[.!?]+$/, '').trim();

  // ───── Bulk / no-arg commands first ─────────────────────────────────────
  if (/^(?:clear|reset|remove)\s+(?:all\s+)?filters?$/i.test(trimmed)) {
    return { kind: 'clear_filters' };
  }
  if (/^(?:clear|reset|remove)\s+(?:the\s+)?sort(?:ing)?$/i.test(trimmed)) {
    return { kind: 'clear_sort' };
  }
  if (
    /^(?:show|unhide|reveal|restore)\s+(?:all\s+)?(?:hidden\s+)?columns?$/i.test(trimmed) ||
    /^unhide\s+all$/i.test(trimmed)
  ) {
    return { kind: 'show_hidden_columns' };
  }

  // ───── Rename ───────────────────────────────────────────────────────────
  const rename =
    /^rename\s+(?:the\s+)?(?:column\s+)?["']?([\w. -]+?)["']?\s+(?:to|as|->|=>)\s+["']?([\w. -]+?)["']?$/i.exec(
      trimmed
    );
  if (rename) {
    return { kind: 'rename_column', from: rename[1].trim(), to: rename[2].trim() };
  }

  // ───── Delete ───────────────────────────────────────────────────────────
  const del =
    /^(?:delete|remove|drop)\s+(?:the\s+)?(?:column|variable)\s+["']?([\w. -]+?)["']?$/i.exec(
      trimmed
    );
  if (del) {
    return { kind: 'delete_column', column: del[1].trim() };
  }

  // ───── Hide column ──────────────────────────────────────────────────────
  const hide = /^hide\s+(?:the\s+)?(?:column\s+)?["']?([\w. -]+?)["']?$/i.exec(trimmed);
  if (hide) {
    return { kind: 'hide_column', column: hide[1].trim() };
  }

  // ───── Sort ─────────────────────────────────────────────────────────────
  // "sort by X", "sort by X desc", "sort X descending", "order by X asc"
  const sort =
    /^(?:sort|order)\s+(?:by\s+)?(?:the\s+)?(?:column\s+)?["']?([\w. -]+?)["']?(?:\s+(asc|ascending|desc|descending|down|up|high to low|low to high))?$/i.exec(
      trimmed
    );
  if (sort) {
    const dirRaw = (sort[2] || '').toLowerCase();
    const direction: 'asc' | 'desc' =
      dirRaw.startsWith('desc') || dirRaw === 'down' || dirRaw === 'high to low' ? 'desc' : 'asc';
    return { kind: 'sort_column', column: sort[1].trim(), direction };
  }

  // ───── Filter: comparison operators ─────────────────────────────────────
  // "filter X > 10", "where X >= 5", "filter X less than 20"
  const cmp =
    /^(?:filter|where|show\s+rows?\s+where|find\s+rows?\s+where|keep)\s+(?:the\s+)?(?:column\s+)?["']?([\w. -]+?)["']?\s+(>=|<=|>|<|=|==|equals?|equal to|greater than|less than|more than|over|under|above|below|contains?|includes?|has|like)\s+["']?([^"']+?)["']?$/i.exec(
      trimmed
    );
  if (cmp) {
    const opRaw = cmp[2].toLowerCase();
    let operator: FilterOperator = 'equals';
    if (
      opRaw === '>' ||
      opRaw === '>=' ||
      opRaw.startsWith('greater') ||
      opRaw === 'more than' ||
      opRaw === 'over' ||
      opRaw === 'above'
    ) {
      operator = 'greaterThan';
    } else if (
      opRaw === '<' ||
      opRaw === '<=' ||
      opRaw.startsWith('less') ||
      opRaw === 'under' ||
      opRaw === 'below'
    ) {
      operator = 'lessThan';
    } else if (
      opRaw.startsWith('contain') ||
      opRaw.startsWith('include') ||
      opRaw === 'has' ||
      opRaw === 'like'
    ) {
      operator = 'contains';
    } else {
      operator = 'equals';
    }
    return {
      kind: 'filter_column',
      column: cmp[1].trim(),
      operator,
      value: cmp[3].trim(),
    };
  }

  // ───── Filter: "filter X by Y" / "filter X to Y" (default contains) ─────
  const filterBy =
    /^filter\s+(?:the\s+)?(?:column\s+)?["']?([\w. -]+?)["']?\s+(?:by|to|for)\s+["']?([^"']+?)["']?$/i.exec(
      trimmed
    );
  if (filterBy) {
    return {
      kind: 'filter_column',
      column: filterBy[1].trim(),
      operator: 'contains',
      value: filterBy[2].trim(),
    };
  }

  // ───── Group / aggregate (opens Aggregate Data dialog) ───────────────────
  const groupBy = /^group\s+(?:by\s+)?(?:the\s+)?(?:column\s+)?["']?([\w. -]+?)["']?$/i.exec(
    trimmed
  );
  if (groupBy) {
    return { kind: 'group_by', column: groupBy[1].trim() };
  }

  const aggregateBy =
    /^aggregate\s+(?:by\s+)?(?:the\s+)?(?:column\s+)?["']?([\w. -]+?)["']?$/i.exec(trimmed);
  if (aggregateBy) {
    return { kind: 'aggregate_by', column: aggregateBy[1].trim() };
  }

  return null;
}

/** Best-effort menu label match. */
function matchMenuLabel(message: string): string | null {
  const lower = message.toLowerCase();

  // exact label match (longest first)
  const labelsByLength = Array.from(LABELS_BY_LOWER.entries()).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [low, label] of labelsByLength) {
    if (lower.includes(low)) return label;
  }

  // synonyms
  const synonymsByLength = Object.entries(SYNONYMS).sort((a, b) => b[0].length - a[0].length);
  for (const [key, label] of synonymsByLength) {
    if (lower.includes(key)) return label;
  }

  return null;
}

/**
 * Resolve a chat message into a dispatchable action.
 *
 * Returns `{ kind: 'chat' }` when no menu intent is detected so callers can
 * fall back to the LLM agent.
 */
export function resolveChatAction(message: string): ChatAction {
  const trimmed = message.trim();
  if (!trimmed) return { kind: 'chat' };

  if (shouldRouteToInlineChart(trimmed)) return { kind: 'chat' };

  const priorityAnalysis = tryPriorityAnalysisAction(trimmed);
  if (priorityAnalysis) return priorityAnalysis;

  const structured = tryStructuredColumnEdit(trimmed);
  if (structured) return structured;

  const label = matchMenuLabel(trimmed);
  if (!label) return { kind: 'chat' };

  if (isDialogMenuItem(label)) {
    return { kind: 'dialog', menuName: label };
  }

  const op = getAnalysisOpForMenuName(label);
  if (op) return { kind: 'analysis', op, menuName: label };

  return { kind: 'unavailable', menuName: label };
}

/** Help text the chat can show users so they know what verbs work. */
export const CHAT_ACTION_HINTS: string[] = [
  'Run correlation / regression / ANOVA / t-test / chi-square',
  'Compute Variable, Recode, Count Values, Standardize',
  'Import Data, Export Data, Merge Datasets',
  'Find Duplicates, Handle Missing Data, Data Quality Report',
  'Rename column X to Y · Delete column X',
  'Sort by X desc · Filter X > 10 · Filter X contains "foo"',
  'Hide column X · Show hidden columns · Clear filters · Clear sort',
  'Group by X · Aggregate by X',
];
