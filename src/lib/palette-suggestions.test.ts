import { suggestPaletteActionsForKind, suggestedPaletteResultsLabel } from './palette-suggestions';

const catalog = [
  { name: 'Standardize Variables' },
  { name: 'Visual Binning' },
  { name: 'Descriptives' },
  { name: 'Rank Cases' },
  { name: 'Frequencies' },
  { name: 'Recode Variables' },
  { name: 'Custom Tables' },
  { name: 'Chi-square' },
  { name: 'Linear Regression' },
];

describe('palette suggestions by column kind', () => {
  it('suggests standardize / binning / descriptives for numeric columns', () => {
    expect(suggestPaletteActionsForKind('numeric', catalog).map(item => item.name)).toEqual([
      'Standardize Variables',
      'Visual Binning',
      'Descriptives',
      'Rank Cases',
    ]);
  });

  it('suggests frequencies / recode / tables for categorical columns', () => {
    expect(suggestPaletteActionsForKind('categorical', catalog).map(item => item.name)).toEqual([
      'Frequencies',
      'Recode Variables',
      'Custom Tables',
      'Chi-square',
    ]);
  });

  it('drops names that are not in the live catalog', () => {
    expect(
      suggestPaletteActionsForKind('numeric', [{ name: 'Descriptives' }]).map(item => item.name)
    ).toEqual(['Descriptives']);
  });

  it('names the results heading with the variable label', () => {
    expect(suggestedPaletteResultsLabel('  Age in years ')).toBe('Suggested for Age in years');
    expect(suggestedPaletteResultsLabel('')).toBe('Suggested');
  });
});
