import { PRODUCTION_MENU_ITEMS, PRODUCTION_ANALYSIS_LABELS } from './production-menu';
import { getAllAnalysisItems, filterAnalysisItems } from './utils';
import { COMING_SOON_SECTIONS } from './palette-catalog';
import { isDialogMenuItem, getAnalysisOpForMenuName } from './menu-registry';
import { RETIRED_FROM_UI_OPS } from '@/lib/retired-from-ui';

/** Labels that open the wrong wizard, a blocked form, or a missing endpoint. */
const DEAD_OR_MISLEADING_LABELS = [
  'Open-text coding',
  'McNemar Test',
  'Loglinear Analysis',
  'Stepwise Regression',
  'Count Values',
  'Heatmap',
  'Latent Class Analysis (LCA, unvalidated)',
  'Reliability Analysis',
  'RM ANOVA',
  'Mixed between/within ANOVA',
];

const REQUIRED_DIALOG_LABELS = ['Compute Variable', 'Shift Values', 'Rake Weights'];

function flattenMenuLabels(): string[] {
  const labels: string[] = [];
  for (const item of Object.values(PRODUCTION_MENU_ITEMS)) {
    for (const names of Object.values(item.sections)) {
      labels.push(...names);
    }
  }
  return labels;
}

describe('production menu false-door sweep', () => {
  it('does not advertise dead or miswired labels in the production catalog', () => {
    const labels = flattenMenuLabels();
    for (const dead of DEAD_OR_MISLEADING_LABELS) {
      expect(labels).not.toContain(dead);
    }
  });

  it('does not surface those labels in the ⌘K palette', () => {
    const names = getAllAnalysisItems().map(item => item.name);
    for (const dead of DEAD_OR_MISLEADING_LABELS) {
      expect(names).not.toContain(dead);
    }
  });

  it('does not show coming-soon section badges', () => {
    expect([...COMING_SOON_SECTIONS]).toEqual([]);
  });

  it('keeps validated LCA on the multivariate menu without the unvalidated suffix', () => {
    const labels = flattenMenuLabels();
    expect(labels).toContain('Latent Class Analysis (LCA)');
    expect(labels).not.toContain('Latent Class Analysis (LCA, unvalidated)');
    expect(PRODUCTION_ANALYSIS_LABELS['Latent Class Analysis (LCA)']).toBe('latent_class_analysis');
    expect(getAnalysisOpForMenuName('Latent Class Analysis (LCA)')).toBe('latent_class_analysis');
  });

  it('restored compute and shift are real dialogs wired in the catalog', () => {
    const labels = flattenMenuLabels();
    for (const name of REQUIRED_DIALOG_LABELS) {
      expect(labels).toContain(name);
      expect(isDialogMenuItem(name)).toBe(true);
      expect(getAllAnalysisItems().some(item => item.name === name)).toBe(true);
    }
  });

  it('puts Rake Weights under Data as a real form, not Weight Cases', () => {
    expect(PRODUCTION_MENU_ITEMS.data.sections['Data preparation']).toContain('Rake Weights');
    expect(flattenMenuLabels()).not.toContain('Weight Cases');
    expect(isDialogMenuItem('Rake Weights')).toBe(true);
    expect(getAnalysisOpForMenuName('Rake Weights')).toBeUndefined();
    expect(
      filterAnalysisItems(getAllAnalysisItems(), 'rake').some(i => i.name === 'Rake Weights')
    ).toBe(true);
  });

  it('puts Custom Tables under Analyze → Tables as a dialog, not Chi-square', () => {
    expect(PRODUCTION_MENU_ITEMS.analyze.sections['Tables']).toEqual(['Custom Tables']);
    expect(isDialogMenuItem('Custom Tables')).toBe(true);
    expect(getAnalysisOpForMenuName('Custom Tables')).toBeUndefined();
    const item = getAllAnalysisItems().find(i => i.name === 'Custom Tables');
    expect(item?.section).toBe('Tables');
    expect(item?.category).toBe('analyze');
    expect(
      filterAnalysisItems(getAllAnalysisItems(), 'banner').some(i => i.name === 'Custom Tables')
    ).toBe(true);
  });

  it('every remaining catalog label launches a dialog or a real analysis op', () => {
    for (const label of flattenMenuLabels()) {
      const launchable = isDialogMenuItem(label) || getAnalysisOpForMenuName(label) != null;
      expect({ label, launchable }).toEqual({ label, launchable: true });
    }
  });

  it('catalog labels are unique', () => {
    const labels = flattenMenuLabels();
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('catalog analysis ops are unique except explicit mode variants', () => {
    const ops = flattenMenuLabels()
      .map(label => getAnalysisOpForMenuName(label))
      .filter((op): op is NonNullable<typeof op> => op != null);
    const counts = new Map<string, number>();
    for (const op of ops) {
      counts.set(op, (counts.get(op) ?? 0) + 1);
    }
    const duplicates = [...counts.entries()].filter(([, n]) => n > 1).map(([op]) => op);
    expect(duplicates.sort()).toEqual(['gradient_boosting']);
  });

  it('does not map a menu label to an op retired from the UI', () => {
    for (const [label, op] of Object.entries(PRODUCTION_ANALYSIS_LABELS)) {
      expect({ label, op, retired: RETIRED_FROM_UI_OPS.has(op) }).toEqual({
        label,
        op,
        retired: false,
      });
    }
  });

  it('⌘K items never launch an op retired from the UI', () => {
    for (const item of getAllAnalysisItems()) {
      if (!item.analysisKey) continue;
      expect({
        name: item.name,
        op: item.analysisKey,
        retired: RETIRED_FROM_UI_OPS.has(item.analysisKey),
      }).toEqual({
        name: item.name,
        op: item.analysisKey,
        retired: false,
      });
    }
  });
});
