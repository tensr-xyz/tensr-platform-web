import {
  IN_SEPARATOR,
  chartFilterPayload,
  conditionCount,
  describeFilter,
  describeFilters,
  rowFiltersPayload,
  sameFilter,
  sharePercent,
  type ColumnValues,
  type FlowFilter,
} from './filters-panel-logic';

const region: ColumnValues = {
  column: 'region',
  values: ['1', '2', '3'],
  counts: { '1': 50, '2': 30, '3': 15 },
  missing: 5,
  n: 100,
  value_labels: { '1': 'North', '2': 'South', '3': 'Northern Ireland' },
};

const columns = [
  { name: 'region', label: 'Region', value_labels: region.value_labels },
  { name: 'q20', label: 'Q20 switch' },
];

describe('filters panel logic', () => {
  it('describes filters in words', () => {
    expect(describeFilter({ column: 'region', op: 'is_none_of', values: ['3'] }, columns[0])).toBe(
      'Region is not Northern Ireland'
    );
    expect(
      describeFilter({ column: 'region', op: 'is_any_of', values: ['1', '2', '3'] }, columns[0])
    ).toBe('Region is North, South or Northern Ireland');
    expect(describeFilter({ column: 'q20', op: 'is_any_of', values: [] }, columns[1])).toBe(
      'Q20 switch (choose a value)'
    );
    expect(
      describeFilters(
        [
          { column: 'region', op: 'is_any_of', values: ['1'] },
          { column: 'q20', op: 'is_any_of', values: ['Very likely'] },
        ],
        columns
      )
    ).toBe('Region is North and Q20 switch is Very likely');
    expect(describeFilters([], columns)).toBe('Everyone');
  });

  it('builds chart-data filters, turning "none of" into the other values', () => {
    const { filters, empty } = chartFilterPayload(
      [
        { column: 'region', op: 'is_none_of', values: ['3'] },
        { column: 'q20', op: 'is_any_of', values: ['Very likely'] },
        { column: 'gender', op: 'is_any_of', values: [] },
      ],
      { region }
    );
    expect(empty).toBe(false);
    expect(filters).toEqual([
      { id: 'region', operator: 'in', value: ['1', '1.0', '2', '2.0'].join(IN_SEPARATOR) },
      { id: 'q20', operator: 'in', value: 'Very likely' },
    ]);
    expect(
      chartFilterPayload([{ column: 'region', op: 'is_none_of', values: ['1', '2', '3'] }], {
        region,
      }).empty
    ).toBe(true);
  });

  it('builds analysis row_filters when equals clauses can say it', () => {
    expect(
      rowFiltersPayload([
        { column: 'region', op: 'is_none_of', values: ['3', '2'] },
        { column: 'q20', op: 'is_any_of', values: ['4'] },
      ])
    ).toEqual([
      { column: 'region', op: 'notEquals', value: '3' },
      { column: 'region', op: 'notEquals', value: '2' },
      { column: 'q20', op: 'equals', value: '4' },
    ]);
    expect(rowFiltersPayload([{ column: 'q20', op: 'is_any_of', values: ['4', '5'] }])).toBeNull();
  });

  it('counts one condition from whole-file counts', () => {
    const anyOf: FlowFilter = { column: 'region', op: 'is_any_of', values: ['1', '2'] };
    expect(conditionCount(anyOf, region)).toBe(80);
    expect(conditionCount({ ...anyOf, op: 'is_none_of', values: ['3'] }, region)).toBe(85);
    expect(conditionCount(anyOf, undefined)).toBeNull();
  });

  it('compares filters and formats a share', () => {
    const a: FlowFilter = { column: 'region', op: 'is_any_of', values: ['1'] };
    expect(sameFilter(a, { ...a, values: ['1'] })).toBe(true);
    expect(sameFilter(a, { ...a, op: 'is_none_of' })).toBe(false);
    expect(sameFilter(a, undefined)).toBe(false);
    expect(sharePercent(2406, 2481)).toBe('97%');
    expect(sharePercent(1, 0)).toBe('0%');
  });
});
