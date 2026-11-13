import {
  answerWithoutBase,
  keepLineBreaks,
  withoutResultTokens,
  outputChecks,
  isProcedurePlaceholder,
  hasSummaryTable,
  outputCardReady,
  outputKind,
  restoreListBreaks,
  outputBaseNote,
  keptModelAnswer,
  outputTakeaway,
  outputTitle,
  titledWithQuestion,
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

  it('uses the question label when the result only names the column', () => {
    const results = [
      {
        procedure: 'frequencies',
        request_body: { columns: ['sat_brewco'] },
        summary: { title: 'sat_brewco', line: 'Frequency table.' },
      },
    ];
    const columns = [{ name: 'sat_brewco', label: 'How satisfied are you with Brew & Co?' }];
    expect(outputTitle(results, 'Frequency table.', columns)).toBe(
      'How satisfied are you with Brew & Co?'
    );
    expect(titledWithQuestion('sat_brewco', columns)).toBe('How satisfied are you with Brew & Co?');
  });

  it('titles a yes or no card with the question', () => {
    const results = [
      {
        procedure: 'frequencies',
        request_body: { columns: ['q_buy'] },
        summary: { title: 'Yes.', line: 'Frequency table.' },
      },
    ];
    const columns = [{ name: 'q_buy', label: 'Would you buy this again?' }];
    expect(outputTitle(results, 'Yes.', columns)).toBe('Would you buy this again?');
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

  it('skips a theme count when a later sentence quotes the shares', () => {
    expect(
      outputTakeaway('9 themes among people who answered. Price is 28% and location is 17%.')
    ).toBe('Price is 28% and location is 17%.');
  });

  it('skips a lead that is only the test name', () => {
    expect(
      outputTakeaway('Chi-square. Awareness and region are related, chi-square = 12.4, p = 0.002.')
    ).toBe('Awareness and region are related, chi-square = 12.4, p = 0.002.');
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

  it('keeps the streamed answer when the finished line is only the procedure', () => {
    const streamed = 'Aware is 75% and recommendation converts at 35% of the satisfied group.';
    expect(keptModelAnswer(streamed, 'Funnel.')).toBe(streamed);
    expect(keptModelAnswer(streamed, streamed)).toBe(streamed);
    expect(keptModelAnswer('{{r1.line}}', 'Aware is 75%.')).toBe('Aware is 75%.');
  });

  it('titles a funnel with the short name, not compute', () => {
    const results = [
      { procedure: 'compute', summary: { title: 'compute' } },
      { procedure: 'funnel', summary: { title: 'Funnel across the stages that were saved.' } },
    ];
    expect(outputTitle(results, 'Aware is the largest stage.')).toBe('Funnel');
  });

  it('titles a funnel with the short name, not the lead', () => {
    const lead =
      'Aware is the largest stage and the last stage converts from the one before it across the whole base.';
    const results = [{ procedure: 'funnel', summary: { title: lead } }];
    expect(outputTitle(results, lead)).toBe('Funnel');
  });

  it('puts a zero weight in checks and titles the card with the test', () => {
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
    expect(outputTitle(results, '54 rows were excluded for missing values.')).toBe('t-test');
    const labels = outputChecks(results).map(check => check.label);
    expect(labels).toContain('2 rows excluded because a selected column was missing');
    expect(labels).toContain('4 rows excluded because the weight was zero or missing');
    expect(labels).toContain('1 rows excluded because they were filtered out');
    expect(labels).toContain('3 rows excluded for another counted reason');
    expect(labels.join(' ')).not.toMatch(/missing values/);
  });

  it('drops an unfilled table citation', () => {
    expect(withoutResultTokens('The subset is below.\n\n{table:r1}')).toBe('The subset is below.');
    expect(withoutResultTokens('See {{table:r2}}.')).toBe('See .');
  });

  it('names a funnel that follows a saved column as Funnel', () => {
    const results = [
      { procedure: 'compute', summary: { line: 'compute; n=800' } },
      { procedure: 'funnel', summary: { title: 'Funnel' } },
    ];
    expect(outputKind(results)).toBe('Funnel');
  });

  it('treats compute progress as a placeholder', () => {
    expect(isProcedurePlaceholder('compute\n\ncompute; n=800')).toBe(true);
    expect(isProcedurePlaceholder('The score is 88.4%.')).toBe(false);
  });

  it('puts each download on its own line', () => {
    const text = keepLineBreaks('Excel workbook: banner.xlsx\nSPSS syntax: tracker.sps');
    expect(text).toBe('Excel workbook: banner.xlsx\n\nSPSS syntax: tracker.sps');
    expect(keepLineBreaks('| a |\n| --- |\n- one\n- two')).toBe('| a |\n| --- |\n- one\n- two');
  });

  it('opens the panel for a table that is still streaming, and keeps a plan without one closed', () => {
    const streaming = {
      status: 'ok',
      tool_results: [
        {
          ok: true,
          procedure: 'funnel',
          summary: { table: [{ title: 'Funnel', columns: ['Stage'], rows: [['Heard']] }] },
        },
      ],
    };
    expect(hasSummaryTable(streaming.tool_results)).toBe(true);
    expect(outputCardReady(streaming, true)).toBe(true);
    expect(
      outputCardReady(
        {
          status: 'ok',
          tool_results: [{ ok: true, procedure: 'rake', run_id: 'run-1', result: { ok: true } }],
        },
        true
      )
    ).toBe(false);
  });

  it('splits a saved lead so one bullet does not run into the next', () => {
    const text = restoreListBreaks('35.3% convert. - By region, North is 20%. - South is 40%.');
    expect(text).toBe('35.3% convert.\n- By region, North is 20%.\n- South is 40%.');
  });
});
