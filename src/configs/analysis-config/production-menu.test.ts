import { getAnalysisOpForMenuName } from './menu-registry';
import { PRODUCTION_ANALYSIS_LABELS, PRODUCTION_MENU_ITEMS } from './production-menu';
import { getAllAnalysisItems } from './utils';

function allMenuLabels(): string[] {
  const names: string[] = [];
  for (const item of Object.values(PRODUCTION_MENU_ITEMS)) {
    for (const labels of Object.values(item.sections)) {
      names.push(...labels);
    }
  }
  return names;
}

describe('production menu false doors', () => {
  it('does not expose Open-text coding from the Analyze menu, palette, or label map', () => {
    expect(allMenuLabels()).not.toContain('Open-text coding');
    expect(PRODUCTION_ANALYSIS_LABELS['Open-text coding']).toBeUndefined();
    expect(Object.values(PRODUCTION_ANALYSIS_LABELS)).not.toContain('code_open_text');
    expect(getAnalysisOpForMenuName('Open-text coding')).toBeUndefined();
    expect(getAllAnalysisItems().map(item => item.name)).not.toContain('Open-text coding');
    expect(getAllAnalysisItems().map(item => item.analysisKey)).not.toContain('code_open_text');
  });
});
