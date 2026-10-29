import {
  categoricalColumns,
  codedColumns,
  codedStub,
  datasetSwitcherLabel,
  efficiencyPercent,
  isInternalColumn,
  lettersFor,
  looksLikeCrosstab,
  newestDatasetId,
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

  it('treats numeric text the way the API coerces it', () => {
    const columns = [
      { name: 'id', type: 'numeric' },
      { name: 'agree_value_numeric', type: 'string' },
      { name: 'region', type: 'string' },
    ];
    const sample = {
      names: ['id', 'agree_value_numeric', 'region'],
      values: [
        ['1', '4', 'North'],
        ['2', '5', 'South'],
      ],
    };
    expect(numericColumns(columns, sample)).toEqual(['id', 'agree_value_numeric']);
    expect(categoricalColumns(columns, sample)).toEqual(['region']);
  });

  it('does not repeat a lineage word that is already the file name', () => {
    expect(
      datasetSwitcherLabel({
        id: 'child',
        original_filename: 'coded',
        lineage_label: 'coded comments',
      })
    ).toBe('coded comments');
  });

  it('opens the newest dataset', () => {
    expect(
      newestDatasetId(
        [
          { id: 'old', updated_at: '2026-01-01T00:00:00Z' },
          { id: 'new', updated_at: '2026-10-01T00:00:00Z' },
        ],
        'old'
      )
    ).toBe('new');
  });

  it('joins a sig letter onto its banner cell', () => {
    expect(
      lettersFor(
        [{ stub_row_id: 'agree', banner_id: 'region=North', letter: 'a' }],
        'agree',
        'region=North'
      )
    ).toBe('a');
  });

  it('sends a coded column as multi-response', () => {
    expect(codedStub('comments_codes')).toEqual({
      column: 'comments_codes',
      multiple_response: true,
      value_delimiter: '|',
    });
    expect(codedStub('region')).toEqual({ column: 'region' });
  });
});
