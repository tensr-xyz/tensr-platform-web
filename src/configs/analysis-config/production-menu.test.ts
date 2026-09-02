import { PRODUCTION_MENU_ITEMS } from './production-menu';
import { getAllAnalysisItems } from './utils';
import { COMING_SOON_SECTIONS } from './palette-catalog';
import { isDialogMenuItem, getAnalysisOpForMenuName } from './menu-registry';

/** Labels that open the wrong wizard, a blocked form, or a missing endpoint. */
const DEAD_OR_MISLEADING_LABELS = [
  'Open-text coding',
  'McNemar Test',
  'Loglinear Analysis',
  'Stepwise Regression',
  'Compute Variable',
  'Count Values',
  'Shift Values',
  'Heatmap',
];

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

  it('every remaining catalog label launches a dialog or a real analysis op', () => {
    for (const label of flattenMenuLabels()) {
      const launchable = isDialogMenuItem(label) || getAnalysisOpForMenuName(label) != null;
      expect({ label, launchable }).toEqual({ label, launchable: true });
    }
  });
});
