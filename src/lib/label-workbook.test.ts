import { labelChangeLine, labelsImportApplyLabel } from './label-workbook';

describe('label workbook helpers', () => {
  it('phrases the apply button from the change count', () => {
    expect(labelsImportApplyLabel(1)).toBe('Apply 1 change');
    expect(labelsImportApplyLabel(212)).toBe('Apply 212 changes');
  });

  it('shows only before and after labels in the change list', () => {
    expect(
      labelChangeLine({
        column: 'gender',
        field: 'question_label',
        before: 'Gender',
        after: 'Sex',
      })
    ).toBe('“Gender” → “Sex”');
    expect(
      labelChangeLine({
        column: 'brand',
        field: 'value_label',
        code: '2',
        before: 'Beta',
        after: 'Brand Beta',
      })
    ).toBe('“Beta” → “Brand Beta”');
  });
});
