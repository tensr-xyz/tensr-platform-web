import { codedStub, efficiencyPercent, selectionFromCell } from './flow-survey';

describe('flow survey grid', () => {
  it('treats a coded open end as a multi-response stub', () => {
    expect(codedStub('open_end_codes')).toEqual({
      column: 'open_end_codes',
      multiple_response: true,
      value_delimiter: '|',
    });
    expect(codedStub('measure')).toEqual({ column: 'measure' });
  });

  it('keeps the cell percent, base, and n for the evidence drill', () => {
    const selected = selectionFromCell(
      { resolved_weight: 'weight' },
      { id: 'row-1', label: 'Theme', source_text_column: 'open_end' },
      {
        banner_id: 'total',
        percent: 25,
        unweighted_n: 4,
        column_unweighted_n: 12,
        provenance: { row_uid_bitset: 'bitset' },
      }
    );
    expect(selected).toMatchObject({
      percent: '25.0%',
      n: '4',
      base: '12',
      weight: 'weight',
      textColumn: 'open_end',
      bitset: 'bitset',
    });
  });

  it('shows rake efficiency as a percent', () => {
    expect(efficiencyPercent(0.82)).toBe('82.0%');
  });
});
