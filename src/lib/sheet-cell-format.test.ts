import {
  formatSheetCellDisplay,
  isWeightColumnId,
  sheetColumnHint,
  variablePanelKind,
} from './sheet-cell-format';

describe('formatSheetCellDisplay', () => {
  it('shows weight cells to two decimal places', () => {
    expect(formatSheetCellDisplay(1.05123456789, 'weight')).toBe('1.05');
    expect(formatSheetCellDisplay('0.987654321', 'weight_5')).toBe('0.99');
    expect(formatSheetCellDisplay(1.15, 'design_weight')).toBe('1.15');
    expect(formatSheetCellDisplay(1.08, '_weight')).toBe('1.08');
  });

  it('leaves other columns as typed', () => {
    expect(formatSheetCellDisplay(1.05123456789, 'Q1')).toBe('1.05123456789');
    expect(formatSheetCellDisplay('East', 'Q3')).toBe('East');
  });

  it('recognises weight column ids', () => {
    expect(isWeightColumnId('weight')).toBe(true);
    expect(isWeightColumnId('raked_weight')).toBe(true);
    expect(isWeightColumnId('gender')).toBe(false);
  });
});

describe('sheetColumnHint', () => {
  it('never prints measure words — only abc or 123', () => {
    expect(sheetColumnHint({ measure: 'scale', type: 'numeric' })).toBe('123');
    expect(sheetColumnHint({ measure: 'nominal', type: 'categorical' })).toBe('abc');
    expect(sheetColumnHint({ measure: 'ordinal', type: 'numeric' })).toBe('123');
    expect(sheetColumnHint({ measure: 'ordinal', type: 'categorical' })).toBe('abc');
    expect(sheetColumnHint({ type: 'string' })).toBe('abc');
    expect(sheetColumnHint({ type: 'id' })).toBe('abc');
  });
});

describe('variablePanelKind', () => {
  it('labels a labelled ordinal as Single choice · ordinal · N codes', () => {
    expect(
      variablePanelKind(
        {
          measure: 'ordinal',
          value_labels: {
            '1': 'Not at all',
            '2': 'Not very',
            '3': 'Neither',
            '4': 'Fairly',
            '5': 'Very',
          },
        },
        5
      )
    ).toBe('Single choice · ordinal · 5 codes');
  });

  it('does not say Single choice for a plain scale', () => {
    expect(variablePanelKind({ measure: 'scale', type: 'numeric' }, 0)).toBe('scale');
  });
});
