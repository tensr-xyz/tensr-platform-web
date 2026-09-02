import { displayBannerTable } from './render';

const BOOK = {
  banner_columns: [
    { id: 'total', label: 'Total', letter_slot: undefined, span: 'total' },
    { id: 'age_band=18-34', label: 'age_band=18-34', letter_slot: 'A', span: '18-34' },
    { id: 'age_band=35-54', label: 'age_band=35-54', letter_slot: 'B', span: '35-54' },
  ],
  rows: [
    {
      id: 'gender:Male',
      label: 'Male',
      kind: 'value',
      cells: [
        {
          banner_id: 'total',
          stub_row_id: 'gender:Male',
          percent: 50,
          row_percent: 100,
          unweighted_n: 2,
          weighted_n: 2,
          kish_ess: 2,
          low_base_suppressed: false,
        },
        {
          banner_id: 'age_band=18-34',
          stub_row_id: 'gender:Male',
          percent: 66.7,
          row_percent: 50,
          unweighted_n: 1,
          weighted_n: 1,
          kish_ess: 1,
          low_base_suppressed: false,
        },
        {
          banner_id: 'age_band=35-54',
          stub_row_id: 'gender:Male',
          percent: 33.3,
          row_percent: 50,
          unweighted_n: 1,
          weighted_n: 1,
          kish_ess: 1,
          low_base_suppressed: true,
        },
      ],
    },
  ],
  letters: [
    {
      stub_row_id: 'gender:Male',
      banner_id: 'age_band=18-34',
      letter: 'b',
      letter_display: 'b',
    },
  ],
};

describe('banner table renderer model', () => {
  it('places letters, column %, row %, and bases on the cell', () => {
    const table = displayBannerTable(BOOK);
    const cell = table.rows[0].cells[1];
    expect(cell.columnPercent).toBe('66.7%');
    expect(cell.rowPercent).toBe('50.0%');
    expect(cell.letters).toBe('b');
    expect(cell.bases).toMatch(/n=1/);
    expect(cell.bases).toMatch(/ESS/);
  });

  it('shows a suppression marker instead of a fake percent on low base', () => {
    const table = displayBannerTable(BOOK);
    const suppressed = table.rows[0].cells[2];
    expect(suppressed.columnPercent).toBe('*');
    expect(suppressed.lowBase).toBe(true);
  });
});
