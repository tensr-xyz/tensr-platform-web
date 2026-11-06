import { analysisSearchBlob, type AnalysisKey } from '@/lib/analysis-definitions';
import { CHOICE_MODELLING_MENU_NAMES, choiceModellingEnabled } from '@/lib/feature-flags';
import { ANALYSIS_COMPONENTS, MENU_ITEMS } from './index';
import { COMING_SOON_SECTIONS, PALETTE_CATALOG } from './palette-catalog';
import { PRODUCTION_ANALYSIS_LABELS } from './production-menu';
import { getMenuItemComponent, isDialogMenuItem } from './menu-registry';

export interface AnalysisItem {
  name: string;
  category: string;
  section: string;
  analysisKey?: AnalysisKey;
  component: ReturnType<typeof getMenuItemComponent> | undefined;
  searchBlob?: string;
  hint?: string;
}

const PALETTE_HINTS: Record<string, string> = {
  'Merge Datasets':
    'Stack or append rows from another file, or join on a key. Use this to stack or append.',
  'Fuse Waves':
    'Stack waves of one survey and keep which wave each row came from. Use this for waves, not a key join.',
  'Fuse Datasets':
    'Join files on a respondent key. Use this when the same people are in more than one file.',
  'Pivot table':
    'Excel-style pivot of counts, sums, means, and percents. Same weights and letters as a banner.',
  Conjoint:
    'Choice-based conjoint. CBC, MNL, or individual utilities, with part-worths and willingness to pay.',
  MaxDiff: 'Best-worst design and scores: counts, logit, and 0-100 rescaled scores.',
};

export const DATA_TAB_VALUE = 'data';
export const PLUGINS_TAB_VALUE = 'plugins';

/** SPSS-style top-level menu tabs for ⌘K (matches menubar families). */
export const PALETTE_TAB_LABELS: Record<string, string> = {
  data: 'Data',
  analyze: 'Analyze',
  transform: 'Transform',
  visualization: 'Charts',
  multivariate: 'Multivariate & SEM',
};

/** Shipped palette tabs. Time series and machine-learning families stay in code, off this bar. */
export const ACTIVE_PALETTE_TABS = [
  DATA_TAB_VALUE,
  'analyze',
  'transform',
  'visualization',
  'multivariate',
] as const;

/** Post-launch families — visible in the tab bar but not selectable (launch plan v2). */
export const COMING_SOON_PALETTE_TABS = [] as const;

export const PALETTE_TAB_ORDER = [...ACTIVE_PALETTE_TABS, ...COMING_SOON_PALETTE_TABS] as const;

export { COMING_SOON_SECTIONS };

const PALETTE_MENU_KEYS = ACTIVE_PALETTE_TABS;

/** Prefer this label when multiple menu names map to the same API op. */
const PREFERRED_MENU_NAME_FOR_OP: Partial<Record<AnalysisKey, string>> = {
  descriptives: 'Descriptives',
  correlation: 'Bivariate Correlations',
  chi_square: 'Chi-square',
  linear_regression: 'Linear Regression',
  logistic_regression: 'Binary Logistic Regression',
  partial_correlation: 'Partial Correlation',
  pca: 'Principal Component Analysis',
  poisson_regression: 'Poisson Regression',
};

function mergedSections(menuKey: string): Record<string, string[]> {
  const production = MENU_ITEMS[menuKey as keyof typeof MENU_ITEMS]?.sections ?? {};
  const catalog = PALETTE_CATALOG[menuKey]?.sections ?? {};
  const merged: Record<string, string[]> = {};

  for (const [sectionName, names] of Object.entries(production)) {
    merged[sectionName] = [...names];
  }
  for (const [sectionName, names] of Object.entries(catalog)) {
    if (merged[sectionName]) {
      const existing = new Set(merged[sectionName]);
      for (const name of names) {
        if (!existing.has(name)) merged[sectionName].push(name);
      }
    } else {
      merged[sectionName] = [...names];
    }
  }

  return merged;
}

/** All section titles for a palette tab, including coming-soon browse-only sections. */
export function getPaletteTabSectionNames(menuKey: string): string[] {
  return Object.keys(mergedSections(menuKey));
}

/**
 * Merge filtered launch items with empty placeholders so coming-soon sections
 * and tabs still appear in ⌘K even when they have no launchable items.
 */
export function getPaletteTabContent(
  grouped: Record<string, Record<string, AnalysisItem[]>>,
  menuKey: string
): Record<string, AnalysisItem[]> {
  const sections: Record<string, AnalysisItem[]> = {};
  for (const sectionName of getPaletteTabSectionNames(menuKey)) {
    sections[sectionName] = [];
  }
  for (const [sectionName, items] of Object.entries(grouped[menuKey] ?? {})) {
    sections[sectionName] = items;
  }
  return sections;
}

function isLaunchableMenuName(name: string): boolean {
  return isDialogMenuItem(name) || name in PRODUCTION_ANALYSIS_LABELS;
}

/** Mode-variant menu names that share one API op but must both appear in ⌘K. */
const MODE_VARIANT_OPS = new Set<AnalysisKey>(['gradient_boosting', 'neural_network_mlp']);

function paletteItemName(menuName: string, op?: AnalysisKey): string {
  if (op && PREFERRED_MENU_NAME_FOR_OP[op]) {
    return PREFERRED_MENU_NAME_FOR_OP[op]!;
  }
  return menuName;
}

/**
 * All analyses and data tools for ⌘K / analysis panel.
 * Grouped like SPSS: top-level menu (Analyze, Data, …) → sections (Compare Means, …) → items.
 */
export function getAllAnalysisItems(): AnalysisItem[] {
  const items: AnalysisItem[] = [];
  const seenOps = new Set<AnalysisKey>();
  const seenNames = new Set<string>();

  for (const menuKey of PALETTE_MENU_KEYS) {
    const sections = mergedSections(menuKey);
    for (const [sectionName, names] of Object.entries(sections)) {
      if (COMING_SOON_SECTIONS.has(sectionName)) {
        continue;
      }

      for (const menuName of names) {
        if (!choiceModellingEnabled() && CHOICE_MODELLING_MENU_NAMES.has(menuName)) {
          continue;
        }
        const op = PRODUCTION_ANALYSIS_LABELS[menuName as keyof typeof PRODUCTION_ANALYSIS_LABELS];
        const displayName = paletteItemName(menuName, op);

        if (op) {
          const preferred = PREFERRED_MENU_NAME_FOR_OP[op];
          if (preferred && menuName !== preferred && menuName !== displayName) {
            if (names.includes(preferred)) continue;
          }
          // Mode variants (GB Class/Reg, MLP Class/Reg) share an op — keep both labels.
          if (seenOps.has(op) && !MODE_VARIANT_OPS.has(op)) continue;
          if (!MODE_VARIANT_OPS.has(op)) seenOps.add(op);
          else if (seenNames.has(displayName)) continue;
        }

        if (seenNames.has(displayName) || !isLaunchableMenuName(menuName)) continue;
        seenNames.add(displayName);

        const component =
          getMenuItemComponent(menuName) ??
          (menuName in ANALYSIS_COMPONENTS
            ? ANALYSIS_COMPONENTS[menuName as keyof typeof ANALYSIS_COMPONENTS]
            : undefined);

        items.push({
          name: displayName,
          category: menuKey,
          section: sectionName,
          analysisKey: op,
          component,
          searchBlob:
            menuName === 'Custom Tables'
              ? 'banner custom tables stub nested banner crosstab cross-tab cross tab xtab'
              : menuName === 'Banner Book'
                ? 'banner book crosstab cross-tab cross tab xtab'
                : menuName === 'Rake Weights'
                  ? 'rake raking ipf weight cases rim'
                  : menuName === 'Cell weighting'
                    ? 'poststratify cell weighting post-stratification'
                    : menuName === 'Export R script'
                      ? 'r script haven sav pipeline export'
                      : menuName === 'Save as recipe'
                        ? 'save recipe analysis history'
                        : menuName === 'Recipes'
                          ? 'recipes run on this dataset export r script'
                          : menuName === 'Merge Datasets'
                            ? 'merge datasets stack append add cases add rows join'
                            : undefined,
          hint: PALETTE_HINTS[menuName],
        });
      }
    }
  }

  return items;
}

/**
 * Words researchers type for an analysis that are not in its menu name.
 * Compared with hyphens, spaces and case ignored (see normalizeSearchText).
 */
export const ANALYSIS_SEARCH_ALIASES: Partial<Record<AnalysisKey, string[]>> = {
  ttest_independent: [
    't-test',
    'ttest',
    't test',
    'student',
    'students t',
    'independent t',
    'two-sample t',
    'two sample t',
    'welch',
    'compare two groups',
  ],
  ttest_paired: [
    't-test',
    'ttest',
    't test',
    'student',
    'students t',
    'paired t',
    'dependent t',
    'repeated t',
    'before after',
    'pre post',
  ],
  ttest_one_sample: ['t-test', 'ttest', 't test', 'one-sample t', 'single sample t'],
  chi_square: [
    'chi-square',
    'chi square',
    'chi2',
    'chisq',
    'chi squared',
    'crosstab',
    'cross-tab',
    'xtab',
    'contingency',
    'pearson chi',
  ],
  fishers_exact: ['fisher', 'fishers exact', 'exact test', 'crosstab'],
  anova_oneway: [
    'anova',
    'one-way anova',
    'f test',
    'f-test',
    'analysis of variance',
    'compare means',
  ],
  anova_twoway: ['anova', 'two-way anova', 'factorial anova', 'analysis of variance'],
  anova_threeway: ['anova', 'three-way anova', 'factorial anova', 'analysis of variance'],
  anova_repeated: ['anova', 'rm anova', 'repeated measures', 'within subjects'],
  manova: ['anova', 'manova', 'multivariate anova'],
  correlation: [
    'correlation',
    'correlate',
    'corr',
    'pearson',
    'spearman',
    'kendall',
    'pearson r',
    'rho',
  ],
  partial_correlation: ['correlation', 'partial corr', 'pearson'],
  linear_regression: ['regression', 'ols', 'linear model', 'lm', 'least squares', 'predict'],
  stepwise_regression: ['regression', 'stepwise', 'ols'],
  logistic_regression: ['regression', 'logit', 'logistic', 'binary outcome', 'glm'],
  poisson_regression: ['regression', 'poisson', 'count model', 'glm'],
  ordinal_regression: ['regression', 'ordinal', 'ordered logit', 'proportional odds'],
  mann_whitney_u: [
    'mann-whitney',
    'mann whitney',
    'mwu',
    'u test',
    'wilcoxon rank sum',
    'rank-sum',
    'nonparametric t',
  ],
  wilcoxon_signed_rank: ['wilcoxon', 'signed rank', 'nonparametric paired'],
  kruskal_wallis: ['kruskal', 'kruskal-wallis', 'nonparametric anova', 'h test'],
  descriptives: ['descriptive', 'summary statistics', 'summary stats', 'mean', 'median', 'sd'],
};

/** Lower-case and drop hyphens, spaces and punctuation: "T-Test" and "t test" both give "ttest". */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function searchTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Everything an item can be found by: name, section, tab, hints, the op label and aliases. */
export function analysisSearchText(item: AnalysisItem): string[] {
  const tabLabel = PALETTE_TAB_LABELS[item.category] ?? item.category;
  return [
    item.name,
    item.section,
    tabLabel,
    item.searchBlob,
    item.hint,
    item.analysisKey ? analysisSearchBlob(item.analysisKey) : '',
    ...(item.analysisKey ? (ANALYSIS_SEARCH_ALIASES[item.analysisKey] ?? []) : []),
  ].filter((part): part is string => Boolean(part));
}

/**
 * True when the query matches the haystack, ignoring hyphens, spaces and case.
 * "independent t" matches word by word; "ttest" matches "T Test" squashed together.
 */
export function searchTextMatches(haystack: string | string[], query: string): boolean {
  const squashedQuery = normalizeSearchText(query);
  if (!squashedQuery) return true;
  const parts = Array.isArray(haystack) ? haystack : [haystack];
  if (parts.some(part => normalizeSearchText(part).includes(squashedQuery))) return true;
  const tokens = searchTokens(query);
  if (tokens.length < 2) return false;
  const words = parts.flatMap(searchTokens);
  return tokens.every((token, index) => {
    const last = index === tokens.length - 1;
    // Short words ("t") must start a word; the last word may be half typed.
    return words.some(word =>
      token.length < 3 || last ? word.startsWith(token) : word.includes(token)
    );
  });
}

/**
 * Filter analysis items by search term
 */
export function filterAnalysisItems(items: AnalysisItem[], searchTerm: string): AnalysisItem[] {
  if (!searchTerm.trim()) {
    return items;
  }
  return items.filter(item => searchTextMatches(analysisSearchText(item), searchTerm));
}

/** Exact and prefix name matches come before a hit that only shares a word in the search text. */
export function rankAnalysisItems(items: AnalysisItem[], query: string): AnalysisItem[] {
  const needle = normalizeSearchText(query);
  if (!needle) return items;
  const score = (item: AnalysisItem) => {
    const name = normalizeSearchText(item.name);
    if (name === needle) return 0;
    if (name.startsWith(needle)) return 1;
    if (name.includes(needle)) return 2;
    return 3;
  };
  return [...items].sort(
    (left, right) => score(left) - score(right) || left.name.localeCompare(right.name)
  );
}

/**
 * Group analysis items by SPSS menu (category) and section
 */
export function groupAnalysisItems(
  items: AnalysisItem[]
): Record<string, Record<string, AnalysisItem[]>> {
  const grouped: Record<string, Record<string, AnalysisItem[]>> = {};

  items.forEach(item => {
    if (!grouped[item.category]) {
      grouped[item.category] = {};
    }
    if (!grouped[item.category][item.section]) {
      grouped[item.category][item.section] = [];
    }
    grouped[item.category][item.section].push(item);
  });

  return grouped;
}
