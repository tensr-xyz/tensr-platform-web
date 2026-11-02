import {
  answerWithoutBase,
  keepLineBreaks,
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

  it('puts each download on its own line', () => {
    const text = keepLineBreaks('Excel workbook: banner.xlsx\nSPSS syntax: tracker.sps');
    expect(text).toBe('Excel workbook: banner.xlsx\n\nSPSS syntax: tracker.sps');
    expect(keepLineBreaks('| a |\n| --- |\n- one\n- two')).toBe('| a |\n| --- |\n- one\n- two');
  });
});
