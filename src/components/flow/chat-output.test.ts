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
  outputTableTabLabel,
  titledWithQuestion,
  guardUserText,
  resultLead,
  outputOpenHref,
  outputRunIds,
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
  it('labels an unsaved agent table without a T number, and keeps a saved one', () => {
    expect(outputTableTabLabel('Region by gender')).toBe('Region by gender');
    expect(outputTableTabLabel('Region by gender', 0)).toBe('Region by gender');
    expect(outputTableTabLabel('Region by gender', null)).toBe('Region by gender');
    expect(outputTableTabLabel('Region by gender', 3)).toBe('T3 Region by gender');
    expect(outputTableTabLabel('  ')).toBe('Table');
  });

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
    expect(
      outputTitle(
        [
          {
            procedure: 'anova_oneway',
            request_body: { value_column: 'likes_A', group_column: 'region' },
          },
        ],
        answer,
        [
          { name: 'likes_A', label: 'How much do you like brand A?' },
          { name: 'region', label: 'Region' },
        ]
      )
    ).toBe('How much do you like brand A? by Region');
    expect(
      outputTitle(
        [
          {
            procedure: 'anova_oneway',
            request_body: { value_column: 'likes_C', group_column: 'age' },
            result: {
              report: {
                answer_from_result: true,
                answer:
                  'How much do you like brand C? by Age band: F(2, 277) = 0.615, p = 0.541, consistent with chance.',
              },
            },
          },
        ],
        answer
      )
    ).toBe('How much do you like brand C? by Age band');
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

  it('rewrites a subtitle of column codes into labels', () => {
    const columns = [
      { name: 'item_a', label: 'Ledger' },
      { name: 'item_b', label: 'Northwind' },
      { name: 'place', label: 'Area' },
    ];
    expect(titledWithQuestion('item_a × item_b × place', columns)).toBe(
      'Ledger × Northwind × Area'
    );
    expect(
      titledWithQuestion(
        'sat_item x place',
        columns.concat([{ name: 'sat_item', label: 'Satisfaction' }])
      )
    ).toBe('Satisfaction × Area');
  });

  it('keeps a rake and table lead when the chat answer is empty', () => {
    const lead = resultLead('', [
      {
        procedure: 'rake',
        summary: {
          line: 'East met its target of 40% (achieved 40%); West missed its target of 60% (achieved 55%).',
        },
      },
      {
        procedure: 'banner_table',
        summary: { line: 'banner_table' },
        result: {
          summary: { line: 'High 62.5%.' },
        },
      },
    ]);
    expect(lead).toMatch(/East met/);
    expect(lead).toMatch(/40%/);
    expect(lead.toLowerCase()).not.toContain('banner_table');
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

  it('titles a funnel even when frequency tables sit beside it', () => {
    const results = [
      {
        procedure: 'frequencies',
        summary: {
          table: [
            { title: 'Have you heard of the item?' },
            { title: 'Have you been to the place?' },
          ],
        },
      },
      { procedure: 'funnel', summary: { title: 'Funnel by group' } },
    ];
    expect(outputTitle(results, 'Heard is 40%.')).toBe('Funnel');
  });

  it('drops a weight code and an empty cautions bullet from the lead', () => {
    const lead = resultLead(
      'Heard is 40% and the last stage is 12%.\nweighted by design_weight\n\nCautions:\n-'
    );
    expect(lead).toContain('40%');
    expect(lead).not.toMatch(/design_weight/);
    expect(lead).not.toMatch(/Cautions/);
    expect(lead.trim().endsWith('-')).toBe(false);
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

  it('keeps a finding and drops a card that is only the base line', () => {
    expect(resultLead('High is 62.5% (12.4 thousand) on East.')).toContain('62.5%');
    expect(resultLead('The weighted base for this table is 80 (unweighted 70).')).toBe('');
    expect(titledWithQuestion('area', [{ name: 'area', label: 'Area' }])).toBe('Area');
  });

  it('splits a saved lead so one bullet does not run into the next', () => {
    const text = restoreListBreaks('35.3% convert. - By region, North is 20%. - South is 40%.');
    expect(text).toBe('35.3% convert.\n- By region, North is 20%.\n- South is 40%.');
  });

  it('drops a promise, a retry, and raw check output from a lead', () => {
    const text = guardUserText(
      "Reach is 40.0%. I'll check the filter. I had it the wrong way round in my earlier reply. Execution halted"
    );
    expect(text).toContain('40.0%');
    expect(text).not.toContain("I'll check");
    expect(text).not.toContain('earlier reply');
    expect(text).not.toContain('Execution halted');
  });

  it('drops an internal procedure name and keeps the result when the answer denies the table', () => {
    const text = guardUserText(
      'The brand_duplication procedure would not accept the subset. banner_table was not run.'
    );
    expect(text).toBe('');
    const lead = resultLead(
      "I can't give the exclusive reach of the other titles. The matrix was not returned. Net reach is 40.0%.",
      [
        {
          summary: {
            line: 'Net reach is 70.0% of this base, 12.5 thousand. Exclusive reach is highest for Alpha.',
          },
        },
      ]
    );
    expect(lead).toContain('70.0%');
    expect(lead).toContain('thousand');
    expect(lead.toLowerCase()).not.toContain('not returned');
    expect(
      outputKind([{ analysis_type: 'brand_duplication' }, { analysis_type: 'banner_table' }])
    ).toBe('Duplication');
    expect(
      outputTitle(
        [{ analysis_type: 'brand_duplication' }, { analysis_type: 'banner_table' }],
        'Overlap'
      )
    ).toBe('Duplication');
  });

  it('uses the result line when the chat answer has no sentence', () => {
    const lead = resultLead('', [{ summary: { line: 'Heard 75.0%, Bought 12.0%.' } }]);
    expect(lead).toContain('75.0%');
    expect(lead).toContain('12.0%');
  });

  it('uses the result line when the chat answer has no figure', () => {
    const lead = resultLead('Here is the table.', [
      { summary: { line: 'Ledger 50.0% (4 thousand).' } },
    ]);
    expect(lead).toContain('50.0%');
    expect(lead).toContain('thousand');
  });

  it('keeps the table figures when the chat answer is only a base and a count', () => {
    const lead = resultLead(
      'The weighted base for this table is 168 (unweighted 40). I used 1 filter.',
      [
        {
          summary: {
            line: 'Brand 39.4% (12.4 thousand). The weighted base for this table is 168 (unweighted 40).',
          },
        },
      ]
    );
    expect(lead).toContain('39.4%');
    expect(lead).not.toContain('weighted base');
  });

  it('reads the lead stored on a reopened banner card', () => {
    const lead = resultLead('', [
      {
        result: {
          summary: {
            line: 'Ledger 50.0% (12.5 thousand). The weighted base for this table is 80.',
          },
        },
      },
    ]);
    expect(lead).toContain('50.0%');
    expect(lead.toLowerCase()).not.toContain('weighted base');
  });

  it('drops raw R from a footnote sentence', () => {
    const text = guardUserText(
      'Ledger is 50.0%. Attaching package: survey. Calls: svydesign.default. masked from package:graphics.'
    );
    expect(text).toContain('50.0%');
    expect(text.toLowerCase()).not.toContain('svydesign');
    expect(text.toLowerCase()).not.toContain('attaching package');
    expect(text.toLowerCase()).not.toContain('masked from');
  });

  it('rewrites a column code that is followed by a comma', () => {
    expect(
      titledWithQuestion('item_a, item_b × seat', [
        { name: 'item_a', label: 'First brand' },
        { name: 'item_b', label: 'Second brand' },
        { name: 'seat', label: 'Role' },
      ])
    ).toBe('First brand, Second brand × Role');
  });

  it('drops a lead that says the table cannot be shown or cites another chat', () => {
    const lead = resultLead(
      "The table can't show inline. An earlier chat had a different funnel. Heard is 40.0% of the base."
    );
    expect(lead.toLowerCase()).not.toContain("can't show inline");
    expect(lead.toLowerCase()).not.toContain('earlier chat');
    expect(lead).toContain('40.0%');
  });

  it('opens a funnel output on that output', () => {
    expect(outputOpenHref('/flow/p/1', 'Funnel', 'run-1')).toBe(
      '/flow/p/1/report?pane=outputs&run=run-1'
    );
    expect(outputOpenHref('/flow/p/1', 'Crosstab', 'run-1')).toBe('/flow/p/1/tables');
    expect(
      outputRunIds([
        { procedure: 'frequencies', ok: true, result: { run_id: 'freq' } },
        { procedure: 'funnel', ok: true, result: { run_id: 'funnel' } },
      ])[0]
    ).toBe('funnel');
  });
});
