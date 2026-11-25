import {
  answerWithoutBase,
  keepLineBreaks,
  withoutResultTokens,
  withoutStrayEnding,
  outputChecks,
  isInvalidContractLead,
  isDeferredResultProse,
  isProcedurePlaceholder,
  hasSummaryTable,
  outputCardReady,
  outputKind,
  restoreListBreaks,
  outputBaseNote,
  keptModelAnswer,
  EMPTY_TURN_ANSWER,
  CONTINUING_TURN_ANSWER,
  UNFINISHED_TURN_ANSWER,
  readableTurnAnswer,
  visibleTurnAnswer,
  outputTakeaway,
  outputTitle,
  outputTableTabLabel,
  titledWithQuestion,
  guardUserText,
  resultLead,
  outputStat,
  outputOpenHref,
  outputRunIds,
  isClientDeckResult,
  clientDeckReportHref,
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
    const longCross =
      'What food and nutrition topics do you keep informed about? × Please select the region you live in.';
    expect(
      outputTitle(
        [
          {
            procedure: 'banner_table',
            analysis_type: 'banner_table',
            summary: { title: longCross },
          },
        ],
        UNFINISHED_TURN_ANSWER
      )
    ).toMatch(/^What food and nutrition topics do you keep informed about\? × Please select/);
    expect(
      outputTitle(
        [
          {
            procedure: 'banner_table',
            analysis_type: 'banner_table',
            summary: { title: longCross },
          },
        ],
        UNFINISHED_TURN_ANSWER
      )
    ).not.toBe('Crosstab');
    expect(
      resultLead(UNFINISHED_TURN_ANSWER, [
        {
          procedure: 'banner_table',
          summary: { line: 'General health leads at 69.7% overall.' },
        },
      ])
    ).toContain('69.7');
    expect(resultLead(UNFINISHED_TURN_ANSWER, [])).toBe('');
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

  it('badges a rake card Weighting and titles it from the summary', () => {
    const results = [
      {
        procedure: 'rake',
        analysis_type: 'rake',
        summary: {
          title: 'Raked to region and gender',
          line: 'Efficiency 87.6%. Effective base 700.5. Weight range 0.52 to 1.71. All targets met.',
          table: [
            {
              title: 'Targets',
              columns: ['Variable', 'Category', 'Target %', 'Achieved %'],
              rows: [['region', 'North', '25%', '25.0%']],
            },
          ],
        },
        result: {
          weighting_efficiency: 0.876,
          diagnostics: { margins: [{ label: 'North', target_percent: 25, achieved_percent: 25 }] },
        },
      },
    ];
    expect(outputKind(results)).toBe('Weighting');
    expect(outputTitle(results, results[0].summary.line)).toBe('Raked to region and gender');
  });

  it('titles a descriptives card Descriptives even when share tables name Region', () => {
    const results = [
      {
        procedure: 'descriptives',
        analysis_type: 'descriptives',
        request_body: { columns: ['region', 'sat'] },
        summary: {
          line: 'Satisfaction averages 3.4 (SD 1.1, median 3, n = 800). Region is categorical, so here are its shares instead.',
          table: [
            {
              title: 'Descriptives',
              rows: [{ label: 'Satisfaction', mean: '3.4', sd: '1.1', median: '3', n: '800' }],
            },
            {
              title: 'Region',
              rows: [{ value: 'North', frequency: 400, percent: 50 }],
            },
          ],
        },
        result: {
          frequency_tables: [{ title: 'Frequency Table: Region', rows: [['North', '400', '50']] }],
        },
      },
    ];
    expect(outputTitle(results, results[0].summary.line)).toBe('Descriptives');
    expect(outputKind(results)).toBe('Descriptives');
    const lead = resultLead(results[0].summary.line, results);
    expect(lead).toContain('Satisfaction averages');
    expect(lead.toLowerCase()).not.toContain('weighted base');
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

  it('shortens several frequency questions to one stem and a count', () => {
    const results = [
      {
        procedure: 'frequencies',
        summary: {
          table: [
            { title: 'Frequency Table: Read or visited: Global Ledger', rows: [] },
            { title: 'Frequency Table: Read or visited: Capital Daily', rows: [] },
            { title: 'Frequency Table: Read or visited: Northwind Post', rows: [] },
          ],
        },
      },
    ];
    expect(outputTitle(results, 'Chart ready.')).toBe('Read or visited and 2 more');
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

  it('prefers a finished finding over pending or model-failed prose', () => {
    const finding = {
      procedure: 'banner_table',
      summary: { line: 'Reach is 39.4% among institutional investors (n = 3000).' },
    };
    const pending = resultLead(
      "The crosstab is still building, so I don't have the column percentages. Its status is pending, and the run reports banner_table; flags: weight_in_use, effective_n.",
      [finding]
    );
    expect(pending).toMatch(/39\.4%/);
    expect(pending.toLowerCase()).not.toContain('still building');
    expect(pending.toLowerCase()).not.toContain('flags:');
    expect(pending.toLowerCase()).not.toContain('banner_table');

    const failed = resultLead('The model call failed, so this turn stopped.', [finding]);
    expect(failed).toMatch(/39\.4%/);
    expect(failed.toLowerCase()).not.toContain('model call failed');
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

  it('fills a visible message when a finished turn has no text', () => {
    expect(visibleTurnAnswer('ok', '')).toBe(EMPTY_TURN_ANSWER);
    expect(visibleTurnAnswer('error', '   ')).toBe(EMPTY_TURN_ANSWER);
    expect(visibleTurnAnswer('continuing', '')).toBe(CONTINUING_TURN_ANSWER);
    expect(visibleTurnAnswer('awaiting_approval', '')).toBe('');
    expect(visibleTurnAnswer('ok', 'The table is ready.')).toBe('The table is ready.');
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

  it('TEN-41: drops a stray weighted-by column line from prose under the reply', () => {
    const prose = withoutStrayEnding(
      answerWithoutBase('Net reach is 62% among the audience.\n\nweighted by proj_weight')
    );
    expect(prose).toContain('62%');
    expect(prose).not.toMatch(/proj_weight/);
    expect(prose).not.toMatch(/weighted by/i);
  });

  it('prefers a labelled structured lead over model prose that quotes codes', () => {
    const structured =
      'No real link between Trust in Global Ledger and Age band. Pearson r = -0.001, p = 0.955, consistent with chance.';
    const lead = resultLead('trust_b1 and age_band: Pearson r = -0.001023, p = 0.955.', [
      { procedure: 'correlation', summary: { line: structured } },
    ]);
    expect(lead).toContain('Trust in Global Ledger');
    expect(lead).toContain('-0.001');
    expect(lead).not.toContain('trust_b1');
    expect(lead).not.toContain('-0.001023');
  });

  it('TEN-40: collapses a code-named correlation when the labelled pair is present', () => {
    const glued =
      'sat_a and usage_a: Spearman ρ = -0.055, p = 0.315, consistent with chance. ' +
      'How satisfied are you with Brand A overall? and How often do you visit Brand A?: ' +
      'Spearman ρ = -0.055, p = 0.315, consistent with chance.';
    const structured =
      'No real link between How satisfied are you with Brand A overall? and How often do you visit Brand A?. ' +
      'Spearman ρ = -0.055, p = 0.315, consistent with chance.';
    const lead = resultLead(glued, [
      {
        procedure: 'correlation',
        summary: { line: structured },
      },
    ]);
    expect(lead).not.toMatch(/sat_a/);
    expect(lead.toLowerCase().split('spearman').length - 1).toBe(1);
    expect(lead).toMatch(/how satisfied are you with brand a overall/i);
  });

  it('TEN-40: bare Spearman ahead of a question-label reading collapses plain-first', () => {
    const glued =
      'Spearman ρ = -0.055, p = 0.315, consistent with chance. ' +
      'No real link between How satisfied are you with Brew & Co overall? and How often do you visit Brew & Co?. ' +
      'Spearman ρ = -0.055, p = 0.315, consistent with chance.';
    const structured =
      'No real link between How satisfied are you with Brew & Co overall? and How often do you visit Brew & Co?. ' +
      'Spearman ρ = -0.055, p = 0.315, consistent with chance.';
    const lead = resultLead(glued, [{ procedure: 'correlation', summary: { line: structured } }]);
    expect(lead.toLowerCase().startsWith('no real link')).toBe(true);
    expect(lead.toLowerCase().split('spearman').length - 1).toBe(1);
    expect(lead).not.toMatch(/overall\? How often/);
    expect(lead.indexOf('No real link')).toBeLessThan(lead.toLowerCase().indexOf('spearman'));
  });

  it('TEN-40: rejects banner_table and Building the table as the card lead', () => {
    expect(resultLead('banner_table', [])).toBe('');
    expect(
      resultLead('Building the table.', [
        { procedure: 'banner_table', summary: { line: 'Building the table.', pending: true } },
      ])
    ).toBe('');
    const finding = 'Brand Alpha leads at 71.1%, ahead of Brand Beta 58.3%.';
    expect(
      resultLead('banner_table', [{ procedure: 'banner_table', summary: { line: finding } }])
    ).toContain('leads');
  });

  it('TEN-40: rejects progress status, tool flags, and prefers finished fields', () => {
    expect(isInvalidContractLead('Current status: pending…')).toBe(true);
    expect(isInvalidContractLead('brand_duplication; flags: weight_in_use')).toBe(true);
    expect(isInvalidContractLead('Title A and Title B share 12k readers.')).toBe(false);

    const bannerFinding = 'Brand Alpha leads at 71.1%, ahead of Brand Beta 58.3%.';
    expect(
      resultLead('Current status: pending…', [
        { procedure: 'banner_table', summary: { line: bannerFinding } },
      ])
    ).toContain('leads');
    expect(
      resultLead('Current status: pending…', [
        { procedure: 'banner_table', summary: { line: 'Current status: pending…' } },
      ])
    ).toBe('');

    const dupFinding = 'Title A and Title B share 12k readers; together they reach 42.5%.';
    expect(
      resultLead('brand_duplication; flags: weight_in_use', [
        {
          procedure: 'brand_duplication',
          summary: { line: dupFinding },
          result: { kind: 'brand_duplication', summary: { line: dupFinding } },
        },
      ])
    ).toContain('42.5%');
    expect(resultLead('brand_duplication; flags: weight_in_use', [])).toBe('');
  });

  it('TEN-192: deferred once-it-finishes prose is never the lead', () => {
    const deferred =
      "Current status: pending. Once it finishes, I'll give you the reach and index for each title.";
    expect(isInvalidContractLead(deferred)).toBe(true);
    const finding = 'FT leads at 21.3% (1,029.1 thousand), ahead of WSJ 49.7%.';
    expect(
      resultLead(deferred, [{ procedure: 'banner_table', summary: { line: finding } }])
    ).toContain('21.3%');
    expect(resultLead(deferred, [])).toBe('');
  });

  it('keeps a funnel lead that already has conversion and high/low figures', () => {
    const apiLine =
      'Aware 100.0%, Tried 40.0% (40.0% from the previous stage), Bought 20.0% (50.0% from the previous stage). ' +
      'By group, United Kingdom 31.3%, Germany 13.8%. United Kingdom is highest at 31.3%; Germany is lowest at 13.8%.';
    const lead = resultLead(
      apiLine,
      [{ procedure: 'funnel', summary: { line: apiLine } }],
      [
        {
          title: 'Funnel',
          columns: ['Stage', 'Count', '% of base', 'Conversion from previous'],
          rows: [
            ['Aware', '1000', '100.0', ''],
            ['Tried', '400', '40.0', '40.0'],
            ['Bought', '200', '20.0', '50.0'],
          ],
        },
        {
          title: 'Funnel by group',
          columns: ['Stage', 'Group', 'Count', '% of base', 'Conversion from previous'],
          rows: [
            ['Bought', 'United Kingdom', '120', '31.3', '40.0'],
            ['Bought', 'Germany', '40', '13.8', '35.0'],
          ],
        },
      ]
    );
    expect(lead).toContain('from the previous stage');
    expect(lead).toContain('highest at 31.3%');
    expect(lead).toContain('lowest at 13.8%');
  });

  it('collapses a repeated Mann-Whitney sentence and trims U trailing zeros', () => {
    const once =
      'Trust for Male and Female: U = 1086523.500, p = 0.121, r = -0.033, consistent with chance. Medians: Male 3, Female 3.';
    const lead = resultLead(`${once} ${once}`, [
      {
        procedure: 'mann_whitney_u',
        summary: { line: once.replace('.500', '.5') },
      },
    ]);
    expect(lead.toLowerCase().split('male and female').length - 1).toBe(1);
    expect(lead).toContain('U = 1086523.5');
    expect(lead).not.toContain('1086523.500');
    expect(lead).toContain('Male');
    expect(lead).toContain('Female');
  });

  it('collapses bare U plus a labelled lead pasted twice', () => {
    const bare = 'U = 1086523.5, p = 0.121, r = -0.033 (negligible), consistent with chance.';
    const labelled =
      'Trust in Global Ledger is about the same for Male and Female. Trust in Global Ledger for Male and Female: U = 1086523.5, p = 0.121, r = -0.033 (negligible), consistent with chance. Medians: Male 3, Female 3. n = 3000.';
    const lead = resultLead(`${bare} ${labelled} ${labelled}`, [
      {
        procedure: 'mann_whitney_u',
        summary: { line: labelled },
      },
    ]);
    expect(lead.toLowerCase().split('u = 1086523.5').length - 1).toBe(1);
    expect(lead.toLowerCase().split('medians: male 3, female 3').length - 1).toBe(1);
    expect(lead).toMatch(/about the same/i);
    expect(lead.indexOf('about the same')).toBeLessThan(lead.indexOf('U ='));
  });

  it('drops empty parentheses and clamps long share percents in the lead', () => {
    const lead = resultLead('Heard is 38.062% ( ) in the North.');
    expect(lead).toContain('38.1%');
    expect(lead).not.toMatch(/38\.062%/);
    expect(lead).not.toMatch(/\(\s*\)/);
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

  it('TEN-40: strips scalar placeholders and never shows them as the reply', () => {
    expect(
      withoutResultTokens('The run is status {{r1.ok}}, and no projected thousands came back.')
    ).not.toContain('{{');
    expect(isInvalidContractLead('The run is status {{r1.ok}}.')).toBe(true);
    expect(isDeferredResultProse('The run is status {{r1.ok}}.')).toBe(true);
    const finding = 'Brand Alpha leads at 71.1%, ahead of Brand Beta 58.3%.';
    expect(
      resultLead('The run is status {{r1.ok}}, and no figures came back.', [
        { procedure: 'banner_table', summary: { line: finding } },
      ])
    ).toContain('71.1%');
    expect(visibleTurnAnswer('ok', 'status {{r1.ok}}')).toBe(EMPTY_TURN_ANSWER);
    expect(keptModelAnswer('status {{r1.ok}}', finding)).toContain('71.1%');
    expect(
      readableTurnAnswer('ok', 'status {{r1.ok}}', [
        { procedure: 'banner_table', summary: { line: finding } },
      ])
    ).toContain('71.1%');
    expect(
      readableTurnAnswer('ok', EMPTY_TURN_ANSWER, [
        { procedure: 'banner_table', summary: { line: finding } },
      ])
    ).toContain('71.1%');
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

  it('does not use a chi_square procedure stub as the lead', () => {
    const lead = resultLead('', [
      {
        summary: {
          line: "chi_square Survey F(3.7, 2944.8) = 3.321, p = 0.012, Cramér's V = 0.150, unlikely to be chance.",
        },
      },
    ]);
    expect(lead).toBe('');
  });

  it('leads with Mann-Whitney and correlation when the reply did not finish', () => {
    const mw =
      'Trust for Men and Women: U = 12, p = 0.121, r = -0.033, consistent with chance. Medians: Men 3, Women 3.';
    const corr =
      'Trust and Income: Pearson r = 0.012, p = 0.494, consistent with chance. n = 3000.';
    const lead = resultLead(EMPTY_TURN_ANSWER, [
      {
        procedure: 'mann_whitney_u',
        summary: {
          line: mw,
          statistic: 'U = 12, p = 0.121, r = -0.033, consistent with chance.',
        },
      },
      {
        procedure: 'correlation',
        summary: {
          line: corr,
          statistic: 'Trust and Income: Pearson r = 0.012, p = 0.494, consistent with chance.',
        },
      },
    ]);
    expect(lead).toContain('U = 12');
    expect(lead).toContain('Pearson r = 0.012');
    expect(lead.toLowerCase()).not.toContain('did not finish');
    expect(
      outputStat(
        [
          {
            procedure: 'mann_whitney_u',
            summary: {
              statistic: 'U = 12, p = 0.121, r = -0.033, consistent with chance.',
            },
          },
        ],
        EMPTY_TURN_ANSWER
      )
    ).toContain('r = -0.033');
  });

  it('badges Mann-Whitney even when the summary carries table rows', () => {
    const results = [
      {
        procedure: 'mann_whitney_u',
        summary: {
          line: 'Trust for Male and Female: U = 12, p = 0.121, r = -0.033, consistent with chance.',
          statistic: 'U = 12, p = 0.121, r = -0.033, consistent with chance.',
          table: [
            {
              title: 'Groups',
              columns: ['Group', 'n', 'Median'],
              rows: [
                ['Male', '8', '3'],
                ['Female', '8', '3'],
              ],
            },
          ],
        },
      },
    ];
    expect(outputKind(results)).toBe('Mann-Whitney');
    expect(outputKind(results)).not.toBe('Frequencies');
    expect(outputStat(results, '')).toContain('r = -0.033');
  });

  it('TEN-93: badges Shapiro-Wilk and Kruskal-Wallis instead of Frequencies', () => {
    expect(
      outputKind([
        {
          procedure: 'shapiro_wilk',
          summary: {
            table: [{ title: 'Test', columns: ['Statistic', 'Value'], rows: [['W', '0.98']] }],
          },
        },
      ])
    ).toBe('Shapiro-Wilk');
    expect(
      outputKind([
        {
          procedure: 'kruskal_wallis',
          summary: {
            table: [{ title: 'Groups', columns: ['Group', 'n'], rows: [['A', '10']] }],
          },
        },
      ])
    ).toBe('Kruskal-Wallis');
  });

  it('badges Correlation and keeps r on the key stat', () => {
    const results = [
      {
        procedure: 'correlation',
        summary: {
          line: 'Trust and Income: Pearson r = 0.012, p = 0.494, consistent with chance.',
          statistic: 'Trust and Income: Pearson r = 0.012, p = 0.494, consistent with chance.',
          table: [{ title: 'Correlations', columns: ['A', 'B'], rows: [['Trust', '0.012']] }],
        },
      },
    ];
    expect(outputKind(results)).toBe('Correlation');
    expect(outputStat(results, '')).toContain('r = 0.012');
  });

  it('reads a structured report answer when the summary line is missing', () => {
    const lead = resultLead('', [
      {
        procedure: 'mann_whitney_u',
        result: {
          report: {
            answer_from_result: true,
            answer: 'Score for Men and Women: U = 18, p = 0.040, r = 0.76, unlikely to be chance.',
          },
        },
      },
    ]);
    expect(lead).toContain('U = 18');
    expect(lead).toContain('r = 0.76');
  });

  it('keeps a chi-square finding that says what differs', () => {
    const lead = resultLead('', [
      {
        summary: {
          line: 'East stands out at 80.0% Yes against 40.0% to 44.0% elsewhere (adjusted residual 4.0).',
        },
      },
    ]);
    expect(lead).toContain('East stands out');
    expect(lead).toContain('80.0%');
    expect(lead.toLowerCase()).not.toContain('chi_square');
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

  it('treats a finished client deck as a Report card, not Outputs', () => {
    const results = [
      {
        name: 'build_client_deck',
        procedure: 'build_client_deck',
        ok: true,
        result: {
          procedure: 'build_client_deck',
          status: 'complete',
          job_id: 'job-deck',
          run_id: 'job-deck',
          key: 'exports/excel/x/client-deck.pptx',
          exports: { key: 'exports/excel/x/client-deck.pptx', filename: 'client-deck.pptx' },
          n_slides: 38,
        },
      },
    ];
    expect(isClientDeckResult(results)).toBe(true);
    expect(outputKind(results)).toBe('Client deck');
    expect(outputCardReady({ status: 'ok', tool_results: results }, false)).toBe(true);
    expect(outputOpenHref('/flow/p/1', 'Client deck', 'job-deck')).toBe(
      '/flow/p/1/report?pane=slides'
    );
    expect(clientDeckReportHref('/flow/p/1')).toBe('/flow/p/1/report?pane=slides');
    expect(outputRunIds(results)[0]).toBe('job-deck');
  });
});
