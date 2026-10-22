import { applyClientColumnFilters, filterRowsByRowUids } from './column-filters';

describe('filterRowsByRowUids', () => {
  const rows = [
    { id: 'row-0', Pos: 'C', Age: 26, _row_uid: 'u-c' },
    { id: 'row-1', Pos: 'SF-PF', Age: 24, _row_uid: 'u-hybrid' },
    { id: 'row-2', Pos: 'PG', Age: 28, _row_uid: 'u-pg' },
  ];

  it('keeps exactly the requested UIDs and matching count', () => {
    const uids = ['u-c', 'u-pg'];
    const filtered = filterRowsByRowUids(rows, uids);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r._row_uid)).toEqual(['u-c', 'u-pg']);
  });

  it('returns no rows when UIDs are empty rather than a partial sheet', () => {
    expect(filterRowsByRowUids(rows, [])).toEqual([]);
  });
});

describe('applyClientColumnFilters', () => {
  it('drops blank and missing cells for is_not_missing', () => {
    const rows = [
      { region: 'north' },
      { region: '' },
      { region: null },
      { region: 'nan' },
      { region: 'south' },
    ];
    const filtered = applyClientColumnFilters(rows, [
      { id: 'region', value: { operator: 'is_not_missing', value: null } },
    ]);
    expect(filtered).toEqual([{ region: 'north' }, { region: 'south' }]);
  });

  it('still supports in-filters', () => {
    const rows = [{ Pos: 'C' }, { Pos: 'PG' }];
    const filtered = applyClientColumnFilters(rows, [
      { id: 'Pos', value: { operator: 'in', value: 'C' } },
    ]);
    expect(filtered).toEqual([{ Pos: 'C' }]);
  });
});
