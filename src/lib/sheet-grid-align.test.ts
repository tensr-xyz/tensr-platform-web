import { gridRowsForColumns } from './sheet-grid-align';

describe('sheet grid alignment', () => {
  it('renders the weight column as numbers when hidden uid columns sit in front', () => {
    const sourceColumnIds = [
      '_row_uid',
      '_source_row_uids',
      'Q1',
      'Survey weight, raked to targets.csv',
    ];
    const columnMajor = [
      ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
      ['["uid-a"]', '["uid-b"]'],
      ['Female', 'Male'],
      [0.84, 1.12],
    ];
    const rows = gridRowsForColumns(columnMajor, sourceColumnIds, [
      { id: 'Q1' },
      { id: 'Survey weight, raked to targets.csv' },
    ]);
    expect(rows[0]['Q1']).toBe('Female');
    expect(rows[0]['Survey weight, raked to targets.csv']).toBe(0.84);
    expect(rows[1]['Survey weight, raked to targets.csv']).toBe(1.12);
    expect(String(rows[0]['Survey weight, raked to targets.csv'])).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-/
    );
  });
});
