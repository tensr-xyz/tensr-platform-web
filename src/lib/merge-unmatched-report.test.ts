import { mergeUnmatchedReportLines } from './merge-unmatched-report';

describe('mergeUnmatchedReportLines', () => {
  it('shows duplicate key counts and the multiply-rows warning', () => {
    expect(
      mergeUnmatchedReportLines(
        {
          row_count: 4,
          unmatched_left_count: 1,
          unmatched_right_count: 0,
          unmatched_left_keys: ['9'],
          duplicate_key_count_left: 0,
          duplicate_key_count_right: 2,
        },
        true
      )
    ).toEqual([
      '4 rows in the result.',
      'Unmatched on this file: 1 (9)',
      'Unmatched on the other file: 0',
      'Duplicate keys on this file: 0',
      'Duplicate keys on the other file: 2',
      'Duplicate keys multiply rows.',
    ]);
  });

  it('shows a label clash on a stack preview', () => {
    expect(
      mergeUnmatchedReportLines(
        {
          row_count: 20,
          source_wave_column: 'source_wave',
          label_conflicts: [
            {
              column: 'Q7',
              kind: 'same_code_different_label',
              code: '1',
              left_label: 'Agree',
              right_label: 'Disagree',
            },
            {
              column: 'region',
              kind: 'code_missing',
              code: '99',
            },
          ],
        },
        false
      )
    ).toEqual([
      '20 rows in the result.',
      'Added source_wave so each row keeps its source file.',
      'Q7 code 1 is "Agree" here and "Disagree" in another file.',
      "region code 99 is in one file's labels and missing from another.",
    ]);
  });

  it('omits duplicate lines when both counts are zero', () => {
    expect(
      mergeUnmatchedReportLines(
        {
          row_count: 1,
          unmatched_left_count: 0,
          unmatched_right_count: 0,
          duplicate_key_count_left: 0,
          duplicate_key_count_right: 0,
        },
        true
      )
    ).toEqual([
      '1 rows in the result.',
      'Unmatched on this file: 0',
      'Unmatched on the other file: 0',
    ]);
  });
});
