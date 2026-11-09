import {
  answerWithoutBase,
  keepLineBreaks,
  outputChecks,
  outputKind,
  outputBaseNote,
  outputTakeaway,
  outputTitle,
} from './chat-output';

const answer = [
  'The weighted base for this table is 312.8 (unweighted 318). No group differs significantly from the one before it; Top 2 is cars_EN 51%, cars_DE 47%, cars_FR 51%.',
  '',
  'base 312.8 weighted (unweighted 318)',
  '',
  '| Stub | Total | cars_EN (A) | cars_DE (B) | cars_FR (C) |',
  '| --- | --- | --- | --- | --- |',
  '| Top 2 | 50.0% | 51.0% | 47.0% | 51.0% |',
  '',
  'Minimum base 30. No column is under that base. No column is under that base..',
  '',
  'Excel workbook: banner.xlsx',
  'SPSS syntax: tracker.sps',
].join('\n');

describe('chat output panel', () => {
  it('titles the panel from the table result, not the base sentence', () => {
    const results = [
      {
        name: 'run_analysis',
        analysis_type: 'banner_table',
        summary: { title: 'How much do you like brand A × source file' },
      },
    ];
    expect(outputTitle(results, answer)).toBe('How much do you like brand A × source file');
    expect(outputKind(results)).toBe('Crosstab');
    expect(
      outputTitle(
        [
          {
            procedure: 'anova_oneway',
            request_body: { value_column: 'likes_A', group_column: 'region' },
          },
        ],
        answer
      )
    ).toBe('likes_A by region');
  });

  it('titles a frequency card with the question and badges Frequencies', () => {
    const results = [
      {
        name: 'run_analysis',
        procedure: 'descriptives',
        request_body: { columns: ['Q5'] },
        summary: { title: 'Q5' },
      },
      {
        procedure: 'frequencies',
        analysis_type: 'frequencies',
        request_body: { columns: ['Q5'] },
        summary: {
          title: 'Frequency table: How would you rate the product? (1-5).',
          line: 'Frequency table: How would you rate the product? (1-5). unweighted. Unweighted base 200.',
          table: [
            {
              title: 'How would you rate the product? (1-5)',
              rows: [{ value: '4', frequency: 20, percent: 31.4 }],
            },
          ],
        },
      },
    ];
    expect(outputTitle(results, 'Frequency table: How would you rate the product? (1-5).')).toBe(
      'How would you rate the product? (1-5)'
    );
    expect(outputKind(results)).toBe('Frequencies');
  });

  it('falls back to the first prose sentence that is not the base', () => {
    expect(outputTitle([], 'Liking is flat across markets.\n\n| a | b |\n| --- | --- |')).toBe(
      'Liking is flat across markets.'
    );
    expect(outputTitle([], 'The weighted base for this table is 312.8 (unweighted 318).')).toBe(
      'Result'
    );
    expect(outputTitle([], '')).toBe('Result');
  });

  it('keeps the takeaway to the finding', () => {
    expect(outputTakeaway(answer)).toBe(
      'No group differs significantly from the one before it; Top 2 is cars_EN 51%, cars_DE 47%, cars_FR 51%.'
    );
  });

  it('writes each base sentence once in the note', () => {
    expect(outputBaseNote(answer)).toBe(
      'The weighted base for this table is 312.8 (unweighted 318). Minimum base 30. No column is under that base.'
    );
  });

  it('keeps the base out of the thread and the table in it', () => {
    const thread = answerWithoutBase(answer);
    expect(thread).not.toMatch(/weighted base|Minimum base|under that base|^base \d/im);
    expect(thread).toContain('| Top 2 | 50.0% | 51.0% | 47.0% | 51.0% |');
    expect(thread.split('\n')[0]).toMatch(/^No group differs significantly/);
  });

  it('puts a zero weight in checks and keeps the statistic as the title', () => {
    const sentence =
      'Independent-Samples T Test. Systolic reading for Placebo and Active: t = 2.400, df = 38.000, p = 0.020. The difference is unlikely to be chance.';
    const results = [
      {
        name: 'run_analysis',
        analysis_type: 'ttest_independent',
        summary: {
          title: sentence,
          exclusion: { missing_selected: 0, zero_or_missing_weight: 4, filtered_out: 1, other: 0 },
        },
        result: {
          report: {
            exclusion_summary: {
              missing_selected: 2,
              zero_or_missing_weight: 4,
              filtered_out: 1,
              other: 3,
            },
          },
        },
      },
    ];
    expect(outputTitle(results, '54 rows were excluded for missing values.')).toBe(sentence);
    const labels = outputChecks(results).map(check => check.label);
    expect(labels).toContain('2 rows excluded because a selected column was missing');
    expect(labels).toContain('4 rows excluded because the weight was zero or missing');
    expect(labels).toContain('1 rows excluded because they were filtered out');
    expect(labels).toContain('3 rows excluded for another counted reason');
    expect(labels.join(' ')).not.toMatch(/missing values/);
  });

  it('puts each download on its own line', () => {
    const text = keepLineBreaks('Excel workbook: banner.xlsx\nSPSS syntax: tracker.sps');
    expect(text).toBe('Excel workbook: banner.xlsx\n\nSPSS syntax: tracker.sps');
    expect(keepLineBreaks('| a |\n| --- |\n- one\n- two')).toBe('| a |\n| --- |\n- one\n- two');
  });
});
