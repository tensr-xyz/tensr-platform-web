import { outputBaseNote, outputTakeaway, outputTitle } from './chat-output';

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
        result: { title: 'How much do you like brand A by source file' },
      },
    ];
    expect(outputTitle(results, answer)).toBe('How much do you like brand A by source file');
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
});
