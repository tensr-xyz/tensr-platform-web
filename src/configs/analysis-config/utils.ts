import { ANALYSIS_COMPONENTS, MENU_ITEMS } from './index';
import { analysisSearchBlob, type AnalysisKey } from '@/lib/analysis-definitions';
import { PRODUCTION_ANALYSIS_LABELS } from './production-menu';
import { COMING_SOON_SECTIONS, PALETTE_CATALOG } from './palette-catalog';
import { getMenuItemComponent, isDialogMenuItem } from './menu-registry';

export interface AnalysisItem {
  name: string;
  category: string;
  section: string;
  analysisKey?: AnalysisKey;
  component: ReturnType<typeof getMenuItemComponent> | undefined;
}

export const DATA_TAB_VALUE = 'data';
export const PLUGINS_TAB_VALUE = 'plugins';

/** SPSS-style top-level menu tabs for ⌘K (matches menubar families). */
export const PALETTE_TAB_LABELS: Record<string, string> = {
  data: 'Data',
  analyze: 'Analyze',
  transform: 'Transform',
  visualization: 'Charts',
  time_series: 'Time series',
  ml_ai: 'ML & AI',
  multivariate: 'Multivariate & SEM',
};

/** Shipped palette tabs. */
export const ACTIVE_PALETTE_TABS = [
  DATA_TAB_VALUE,
  'analyze',
  'transform',
  'visualization',
  'time_series',
  'ml_ai',
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
  chi_square: 'Crosstabs',
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
  return (
    name in ANALYSIS_COMPONENTS || name in PRODUCTION_ANALYSIS_LABELS || isDialogMenuItem(name)
  );
}

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
        const op = PRODUCTION_ANALYSIS_LABELS[menuName as keyof typeof PRODUCTION_ANALYSIS_LABELS];
        const displayName = paletteItemName(menuName, op);

        if (op) {
          const preferred = PREFERRED_MENU_NAME_FOR_OP[op];
          if (preferred && menuName !== preferred && menuName !== displayName) {
            if (names.includes(preferred)) continue;
          }
          if (seenOps.has(op)) continue;
          seenOps.add(op);
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
        });
      }
    }
  }

  return items;
}

/**
 * Filter analysis items by search term
 */
export function filterAnalysisItems(items: AnalysisItem[], searchTerm: string): AnalysisItem[] {
  if (!searchTerm.trim()) {
    return items;
  }

  const lowerSearchTerm = searchTerm.toLowerCase();

  return items.filter(item => {
    if (item.analysisKey && analysisSearchBlob(item.analysisKey).includes(lowerSearchTerm)) {
      return true;
    }
    const matchesName = item.name.toLowerCase().includes(lowerSearchTerm);
    const matchesSection = item.section.toLowerCase().includes(lowerSearchTerm);
    const tabLabel = PALETTE_TAB_LABELS[item.category] ?? item.category;
    const matchesCategory = tabLabel.toLowerCase().includes(lowerSearchTerm);
    return matchesName || matchesSection || matchesCategory;
  });
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
