import { findingFromTable, type ReportTable } from './flow-report';

const table: ReportTable = {
  id: 'spec-1',
  label: 'agree by region',
  index: 1,
  tested: true,
  columns: [
    { id: 'north', label: 'region=North', letter_slot: 'A' },
    { id: 'east', label: 'region=East', letter_slot: 'B' },
  ],
  letters: [{ stub_row_id: 'price', banner_id: 'east', letter: 'A' }],
  rows: [
    {
      id: 'staff',
      label: 'Staff',
      kind: 'value',
      cells: [
        {
          banner_id: 'north',
          percent: 2,
          unweighted_n: 2,
          column_unweighted_n: 80,
          low_base: true,
        },
        { banner_id: 'east', percent: 4, unweighted_n: 3, column_unweighted_n: 81, low_base: true },
      ],
    },
    {
      id: 'price',
      label: 'Price too high',
      kind: 'value',
      cells: [
        { banner_id: 'north', percent: 7.5, unweighted_n: 6, column_unweighted_n: 80 },
        { banner_id: 'east', percent: 16, unweighted_n: 13, column_unweighted_n: 81 },
      ],
    },
  ],
};

const flat: ReportTable = {
  ...table,
  id: 'spec-2',
  index: 2,
  letters: [],
  rows: [
    {
      id: 'agree',
      label: 'Agree',
      kind: 'value',
      cells: [
        { banner_id: 'north', percent: 40 },
        { banner_id: 'east', percent: 38 },
      ],
    },
    {
      id: 'top2',
      label: 'Top 2',
      kind: 'net',
      cells: [
        { banner_id: 'north', percent: 85.5 },
        { banner_id: 'east', percent: 84 },
      ],
    },
  ],
};

describe('report findings', () => {
  it('leads with the largest significant gap in plain English', () => {
    const finding = findingFromTable(table, null, null);
    expect(finding.headline).toBe('East is higher than North on Price too high: 16% against 7.5%.');
    expect(finding.support).toBe('That 8.5-point gap is significant at 95%.');
    expect(finding.citation).toBe('T1');
    expect(finding.significant).toBe(true);
    expect(finding.bars).toEqual([
      { label: 'North', percent: 7.5 },
      { label: 'East', percent: 16 },
    ]);
    expect(`${finding.headline} ${finding.support}`).not.toMatch(/\brow \d/i);
  });

  it('leads with Top 2 when nothing differs, and says so', () => {
    const finding = findingFromTable(flat, null, null);
    expect(finding.headline).toBe('Top 2 is highest in North at 85.5% and lowest in East at 84%.');
    expect(finding.support).toBe('None of the differences between columns is significant at 95%.');
    expect(finding.citation).toBe('T2');
    expect(finding.significant).toBe(false);
  });

  it('uses the selected rows when a filter cut is applied', () => {
    const finding = findingFromTable(table, null, [{ tableId: 'spec-1', number: 1 }]);
    expect(finding.lowBase).toBe(true);
    expect(finding.headline).toBe('Staff is highest in East at 4% and lowest in North at 2%.');
    expect(finding.citation).toBe('T1');
  });

  it('describes one segment without a comparison', () => {
    const finding = findingFromTable(flat, 'east', null);
    expect(finding.headline).toBe('Top 2 is 84% in East.');
    expect(finding.bars).toEqual([{ label: 'Agree', percent: 38 }]);
  });
});
