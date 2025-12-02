import { MENU_ITEMS, ANALYSIS_COMPONENTS } from './index';

export interface AnalysisItem {
  name: string;
  category: string;
  section: string;
  component: (typeof ANALYSIS_COMPONENTS)[string] | undefined;
}

/**
 * Extract all analysis items from the specified categories
 */
export function getAllAnalysisItems(): AnalysisItem[] {
  const categories = [
    'transform',
    'analyze',
    'visualization',
    'time_series',
    'ml_ai',
    'syntax',
    'utilities',
  ];
  const items: AnalysisItem[] = [];

  categories.forEach(category => {
    const menuItem = MENU_ITEMS[category];
    if (!menuItem || !menuItem.sections) return;

    Object.entries(menuItem.sections).forEach(([sectionName, sectionItems]) => {
      sectionItems.forEach(itemName => {
        items.push({
          name: itemName,
          category,
          section: sectionName,
          component: ANALYSIS_COMPONENTS[itemName],
        });
      });
    });
  });

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
    const matchesName = item.name.toLowerCase().includes(lowerSearchTerm);
    const matchesSection = item.section.toLowerCase().includes(lowerSearchTerm);
    const matchesCategory = item.category.toLowerCase().includes(lowerSearchTerm);
    return matchesName || matchesSection || matchesCategory;
  });
}

/**
 * Group analysis items by category and section
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
