import { visibleAgentStep } from '@/lib/agent-step-copy';

const SHOWN = [
  ['run_analysis', '', 'Ran the analysis'],
  ['read_data', '', 'Read the open file'],
  ['data_edit', '', 'Edited the data'],
  ['banner_table', '', 'Built a table'],
  ['descriptives', '', 'Summarised the columns'],
  ['frequencies', '', 'Counted the values'],
  ['ttest_independent', '', 'Compared two groups'],
  ['chi_square', '', 'Tested the table'],
  ['linear_regression', '', 'Fitted a regression'],
  ['compute', '', 'Computed a new column'],
  ['code_open_text', '', 'Coded the open answers'],
  ['import_file', '', 'Imported a file'],
] as const;

const HIDDEN = [
  ['finish', 'Running finish'],
  ['get_result', 'Running get result'],
  ['set_requirements', 'Running set requirements'],
  ['warming', 'Warming up'],
  ['resume', 'Continuing this turn'],
  ['tool', 'Running tool'],
];

describe('visibleAgentStep', () => {
  it.each(SHOWN)('keeps %s as plain English', (step, message, expected) => {
    expect(visibleAgentStep(step, message)).toBe(expected);
  });

  it.each(HIDDEN)('drops filler from %s', (step, message) => {
    expect(visibleAgentStep(step, message)).toBeNull();
  });

  it('keeps a sentence the server already wrote in plain English', () => {
    expect(visibleAgentStep('run_analysis', 'Compared the two groups on the open file.')).toBe(
      'Compared the two groups on the open file.'
    );
  });
});
