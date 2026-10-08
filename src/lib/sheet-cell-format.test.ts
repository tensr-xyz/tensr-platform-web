import { formatSheetCellDisplay } from './sheet-cell-format';

describe('formatSheetCellDisplay', () => {
  it('shows weight cells to 4 decimal places', () => {
    expect(formatSheetCellDisplay(1.05123456789, '_weight')).toBe('1.0512');
    expect(formatSheetCellDisplay('0.987654321', '_weight')).toBe('0.9877');
  });

  it('leaves other columns as typed', () => {
    expect(formatSheetCellDisplay(1.05123456789, 'Q1')).toBe('1.05123456789');
    expect(formatSheetCellDisplay('East', 'Q3')).toBe('East');
  });
});
