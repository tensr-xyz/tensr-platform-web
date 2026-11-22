import {
  suggestPaletteActionsForKind,
  suggestedPaletteResultsLabel,
  PALETTE_ASK_CHAT_HINT,
} from './palette-suggestions';

const catalog = [
  { name: 'Standardize Variables' },
  { name: 'Visual Binning' },
  { name: 'Descriptives' },
  { name: 'Rank Cases' },
  { name: 'Frequencies' },
  { name: 'Recode Variables' },
  { name: 'Custom Tables' },
  { name: 'Chi-square' },
  { name: 'Driver Analysis' },
  { name: 'Linear Regression' },
];

describe('palette suggestions by column kind', () => {
  it('suggests standardize / binning / descriptives for numeric columns', () => {
    expect(
      suggestPaletteActionsForKind('numeric', catalog).map(row => ({
        label: row.label,
        menuName: row.menuName,
      }))
    ).toEqual([
      { label: 'Standardize Variables', menuName: 'Standardize Variables' },
      { label: 'Visual Binning', menuName: 'Visual Binning' },
      { label: 'Descriptives', menuName: 'Descriptives' },
      { label: 'Rank Cases', menuName: 'Rank Cases' },
    ]);
  });

  it('suggests top-2 / crosstab / drivers for categorical columns', () => {
    const rows = suggestPaletteActionsForKind('categorical', catalog, 'Satisfaction with service');
    expect(rows.map(row => row.label)).toEqual([
      'Top-2 box',
      'Crosstab by a banner',
      'Driver Analysis',
    ]);
    expect(rows[0]?.ask).toBe('Top-2 box for Satisfaction with service');
    expect(rows[1]?.menuName).toBe('Custom Tables');
    expect(rows[2]?.menuName).toBe('Driver Analysis');
  });

  it('drops names that are not in the live catalog', () => {
    expect(
      suggestPaletteActionsForKind('numeric', [{ name: 'Descriptives' }]).map(row => row.label)
    ).toEqual(['Descriptives']);
  });

  it('names the focused heading For "label" (Paper 10d)', () => {
    expect(suggestedPaletteResultsLabel('  Age in years ')).toBe('For "Age in years"');
    expect(suggestedPaletteResultsLabel('')).toBe('Suggested');
  });

  it('keeps the ask-chat idle hint copy', () => {
    expect(PALETTE_ASK_CHAT_HINT).toMatch(/ask chat/i);
  });
});
