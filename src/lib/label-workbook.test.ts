import {
  labelChangeLine,
  labelsImportAppliedNote,
  labelsImportApplyLabel,
  labelsImportPreviewNote,
  unmatchedLabelLine,
} from './label-workbook';

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

  it('phrases preview and apply notes so upload is never silent', () => {
    expect(labelsImportPreviewNote({ labels_changed: 2, unmatched: 1, code_changed: 0 })).toBe(
      '2 labels ready to apply · 1 row not matched.'
    );
    expect(labelsImportPreviewNote({ labels_changed: 0, unmatched: 3, code_changed: 1 })).toBe(
      'No label changes to apply · 3 rows not matched · 1 code change not allowed.'
    );
    expect(labelsImportPreviewNote({ labels_changed: 0, unmatched: 0, code_changed: 0 })).toBe(
      'No label changes found in that file.'
    );
    expect(labelsImportAppliedNote(2)).toBe('2 labels updated · saved as a new version.');
    expect(labelsImportAppliedNote(1)).toBe('1 label updated · saved as a new version.');
  });

  it('lists unmatched rows without exposing internal codes as the primary label', () => {
    expect(
      unmatchedLabelLine({
        name: 'missing_col',
        code: '1',
        reason: 'question not in this file',
      })
    ).toBe('missing_col · 1 — question not in this file');
    expect(unmatchedLabelLine({ name: 'q_extra', reason: 'question not in this file' })).toBe(
      'q_extra — question not in this file'
    );
  });
});
