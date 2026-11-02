import { dependentColumns, openEndColumns } from './flow-columns';

describe('ANOVA dependent columns', () => {
  it('keeps a numeric companion when the preview type is text and id is the only numeric type', () => {
    const names = dependentColumns([
      { name: 'id', type: 'numeric' },
      { name: 'agree_value_numeric', type: 'string', measure: 'nominal' },
      { name: 'comment', type: 'string' },
    ]);
    expect(names).toContain('agree_value_numeric');
    expect(names).toContain('id');
    expect(names).not.toContain('comment');
  });

  it('keeps a scale measure whose stored type is not numeric', () => {
    expect(dependentColumns([{ name: 'satisfaction', type: 'string', measure: 'scale' }])).toEqual([
      'satisfaction',
    ]);
  });
});

describe('code frame open ends', () => {
  it('keeps text columns and drops numeric and already-coded ones', () => {
    expect(
      openEndColumns([
        { name: 'comments', type: 'string' },
        { name: 'Q7', type: 'numeric' },
        { name: 'agree_value', type: 'string', measure: 'ordinal' },
        { name: 'comments_codes', type: 'string' },
        { name: 'region', type: 'string', measure: 'nominal' },
      ])
    ).toEqual(['comments', 'region']);
  });
});

describe('picker columns', () => {
  it('drops row ids, coding scratch, and stored codes', () => {
    const { pickerColumns, isInternalColumn } = jest.requireActual('./flow-columns');
    expect(
      pickerColumns([
        { name: '_row_uid' },
        { name: 'comments_coding' },
        { name: 'comments_codes' },
        { name: 'region' },
      ]).map((column: { name: string }) => column.name)
    ).toEqual(['region']);
    expect(isInternalColumn('source_wave')).toBe(false);
  });

  it('offers coded open ends by their open-end name', () => {
    const { themeColumns } = jest.requireActual('./flow-columns');
    expect(
      themeColumns([
        { name: 'comments_codes', label: 'Codes for comments' },
        { name: 'Q7_codes' },
        { name: 'region', label: 'Region' },
      ])
    ).toEqual([
      { value: 'comments_codes', label: 'comments' },
      { value: 'Q7_codes', label: 'Q7' },
    ]);
  });
});
