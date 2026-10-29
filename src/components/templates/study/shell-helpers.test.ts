import {
  categoricalColumns,
  codedColumns,
  datasetSwitcherLabel,
  efficiencyPercent,
  isInternalColumn,
  looksLikeCrosstab,
  numericColumns,
  visibleColumns,
} from './shell-helpers';

describe('study shell helpers', () => {
  it('hides respondent ids and coding json', () => {
    expect(isInternalColumn('_row_uid')).toBe(true);
    expect(isInternalColumn('comment_coding')).toBe(true);
    expect(visibleColumns(['_row_uid', 'comment', 'comment_codes', 'comment_coding'])).toEqual([
      'comment',
      'comment_codes',
    ]);
  });

  it('keeps coded columns and drops internal ones from the theme picker', () => {
    expect(codedColumns(['_row_uid', 'comment_codes', 'comment_coding', 'gender'])).toEqual([
      'comment_codes',
      'gender',
    ]);
  });

  it('splits factor and dependent columns by type', () => {
    const columns = [
      { name: 'gender', type: 'string', measure: 'nominal' },
      { name: 'agree_value_numeric', type: 'numeric', measure: 'scale' },
      { name: '_row_uid', type: 'string' },
    ];
    expect(numericColumns(columns)).toEqual(['agree_value_numeric']);
    expect(categoricalColumns(columns)).toEqual(['gender']);
  });

  it('labels a derived file with its lineage', () => {
    expect(
      datasetSwitcherLabel({
        id: 'child',
        original_filename: 'wave.sav',
        lineage_label: 'coded comments',
      })
    ).toBe('wave.sav · coded comments');
  });

  it('prints weighting efficiency as a percentage', () => {
    expect(efficiencyPercent(0.842)).toBe('84.2%');
    expect(efficiencyPercent(84.2)).toBe('84.2%');
  });

  it('recognises a crosstab answer', () => {
    expect(looksLikeCrosstab('| Price | 40% |')).toBe(true);
    expect(looksLikeCrosstab('The base is 400.')).toBe(false);
  });
});
