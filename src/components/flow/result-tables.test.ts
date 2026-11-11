import {
  answerResultTables,
  resultFootnote,
  resultViewFromToolResults,
  weightNote,
} from './result-tables';

const payloads = [
  {
    frequency_tables: [
      {
        title: 'Frequency Table: Region',
        columns: ['', 'Frequency', 'Percent', 'Valid Percent', 'Cumulative Percent'],
        rows: [
          ['North', '12', '40', '40', '40'],
          ['South', '18', '60', '60', '100'],
        ],
      },
    ],
  },
  {
    code_frequency: [
      { label: 'Queue', n: 4, percent: 40, quote: 'Waited too long' },
      { label: 'Price', n: 6, percent: 60, example: 'Too dear' },
    ],
  },
  {
    group_descriptives: [
      { label: 'A', n: 10, mean: 3.2, std: 0.4 },
      { group: 'B', n: 8, mean: 2.1, sd: 0.5 },
    ],
  },
  {
    diagnostics: {
      margins: [
        { column: 'region', label: 'North', target_percent: 40, achieved_percent: 39.5 },
        { column: 'region', level: 'South', target: 60, achieved: 60.5 },
      ],
    },
  },
  {
    report: {
      tables: [
        { title: 'Coefficients', columns: ['Predictor', 'B', 'p'], rows: [['Age', '0.2', '0.04']] },
      ],
      reproducibility: { r_script: 'lm(score ~ age, data = d)' },
      assumption_checks: { notes: ['Residuals look even.'] },
    },
  },
  {
    tables: [{ title: 'Reach', columns: ['Combination', 'Reach %'], rows: [['A+B', '62']] }],
  },
  {
    result: {
      frequency_tables: [
        {
          title: 'Item',
          columns: ['Answer', 'Count'],
          rows: [
            ['Yes', '3'],
            ['No', '1'],
          ],
        },
      ],
    },
  },
  { weight: { column: 'design_w' }, filter_ref: 'region = North' },
  {
    filters: [{ column: 'city', op: '=', value: 'Leeds' }],
    tables: [{ title: 'Means', columns: ['Variable', 'Mean'], rows: [['Score', '4.1']] }],
  },
  {
    code_frequency: [{ code: 'other', n: 1, percent: 100, quote: 'Something else' }],
    weight: { column: 'w' },
  },
  {
    group_descriptives: [{ label: 'Left', n: 5, mean: 1, std: 0.2 }],
    assumption_checks: { warnings: ['One group is small.'] },
  },
  {
    diagnostics: {
      margins: [{ column: 'band', label: 'High', target_percent: 20, achieved_percent: 20 }],
    },
    reproducibility: { r_script: 'survey::svymean(~score, design)' },
  },
];

describe('result tables', () => {
  it('reads a table from each of twelve different result shapes', () => {
    const views = payloads.map(payload => resultViewFromToolResults(payload));
    expect(views.filter(view => view.tables.length || view.filter || view.weight)).toHaveLength(12);
    expect(views[0].tables[0].rows[0][0]).toBe('North');
    expect(views[0].tables[0].columns[0]).toBe('');
    expect(views[0].tables[0].columns[1]).toBe('Frequency');
    expect(views[1].tables[0].columns).toEqual([
      'Theme',
      'Count',
      '% of people who answered',
      'Quote',
    ]);
    expect(views[1].tables).toHaveLength(1);
    expect(views[2].tables[0].title).toBe('Group means');
    expect(views[3].tables[0].columns).toContain('Achieved %');
    expect(views[4].script).toContain('lm(');
    expect(views[4].checks).toEqual(['Residuals look even.']);
    expect(views[7].filter).toBe('region = North');
    expect(views[7].weight).toBe('design_w');
    expect(views[8].filter).toBe('city = Leeds');
    expect(resultFootnote(views[7], 'n = 40', 't-test')).toBe(
      'n = 40 · Filter: region = North · Weight: design_w · t-test'
    );
  });

  it('shows one theme table, with a weighted column only when a weight is present', () => {
    const plain = resultViewFromToolResults({
      code_frequency: [
        { label: 'Price', n: 6, percent: 60, quote: 'Too dear' },
        { label: 'Other', n: 1, percent: 10, quote: 'Something else' },
      ],
      report: {
        tables: [
          {
            title: 'Themes among people who answered',
            columns: ['Theme', 'Unweighted count', 'Unweighted %', 'Example'],
            rows: [
              ['Price', '6', '60', 'Too dear'],
              ['Other', '1', '10', 'Something else'],
            ],
          },
        ],
      },
    });
    expect(plain.tables.map(table => table.title)).toEqual(['Themes']);
    expect(plain.tables[0].columns).not.toContain('Weighted %');
    const weighted = resultViewFromToolResults({
      code_frequency: [
        { label: 'Price', n: 6, percent: 60, weighted_percent: 55, quote: 'Too dear' },
      ],
    });
    expect(weighted.tables[0].columns).toEqual([
      'Theme',
      'Unweighted count',
      'Weighted %',
      'Quote',
    ]);
    expect(weighted.tables[0].rows[0][1]).toBe('6');
    expect(weighted.tables[0].rows[0][2]).toBe('55');
  });

  it('renders every summary table with its question, and keeps one set when the engine grid is there too', () => {
    const view = resultViewFromToolResults({
      summary: {
        table: [
          {
            title: 'What is your gender?',
            rows: [
              { value: 'Female', frequency: 12, percent: 60 },
              { value: 'Male', frequency: 8, percent: 40 },
            ],
          },
          {
            title: 'Which region do you live in?',
            rows: [{ value: 'West', frequency: 11, percent: 55.5 }],
          },
        ],
      },
      frequency_tables: [
        {
          title: 'Frequency Table: What is your gender?',
          columns: ['', 'Frequency', 'Percent (incl. missing)', 'Valid Percent'],
          rows: [['Female', '12', '60.0', '60.0']],
        },
      ],
      filters: [{ column: 'region', op: '=', value: 'London' }],
    });
    expect(view.tables.map(table => table.title)).toEqual([
      'What is your gender?',
      'Which region do you live in?',
    ]);
    expect(view.tables[0].columns).toEqual(['Answer', 'Frequency', 'Percent']);
    expect(view.tables[0].rows[0]).toEqual(['Female', '12', '60']);
    expect(view.tables[1].rows[0][2]).toBe('55.5');
    expect(view.filter).toBe('region = London');
    expect(resultFootnote(view, 'Unweighted base 191.', 'Frequencies')).toBe(
      'Unweighted base 191. · Filter: region = London · Unweighted · Frequencies'
    );
  });

  it('writes the filter and the weight with their labels', () => {
    const view = resultViewFromToolResults({
      filters: [{ column: 'region', op: '=', value: '4' }],
      weight: { column: 'design_weight' },
      frequency_tables: [
        {
          title: 'Frequency Table: Satisfaction',
          columns: ['', 'Frequency', 'Valid Percent'],
          rows: [['Satisfied', '60', '31.4']],
        },
      ],
    });
    const columns = [
      {
        name: 'region',
        label: 'Region',
        value_labels: { '4': 'London' },
      },
      { name: 'design_weight', label: 'Design weight' },
      { name: 'weight', label: 'weight' },
    ];
    expect(resultFootnote(view, 'Base 191', 'Frequencies', columns)).toBe(
      'Base 191 · Filter: Region = London · Weight: Design weight · Frequencies'
    );
    const namedWeight = resultViewFromToolResults({ weight: { column: 'weight' } });
    expect(resultFootnote(namedWeight, '', 'Frequencies', columns)).toBe('Weighted · Frequencies');
  });

  it('keeps the frequency base and drops an exclusion count that is not this table', () => {
    const kept = resultViewFromToolResults({
      report: {
        exclusion_summary: { rows_used: 191 },
        tables: [
          {
            title: 'Frequency Table: Satisfaction',
            columns: ['', 'Frequency', 'Valid Percent'],
            rows: [
              ['Satisfied', '60', '31.4'],
              ['Total', '248', ''],
            ],
          },
        ],
      },
    });
    expect(kept.base).toBe('Base 191');
    const dropped = resultViewFromToolResults({
      report: {
        exclusion_summary: { rows_used: 17 },
        tables: [
          {
            title: 'Frequency Table: Gender',
            columns: ['', 'Frequency', 'Valid Percent'],
            rows: [
              ['Female', '108', '54.3'],
              ['Total', '200', '100'],
            ],
          },
        ],
      },
    });
    expect(dropped.base).toBe('');
  });

  it('uses the answered base when the footnote has no exclusion count', () => {
    const fromRows = resultViewFromToolResults({
      procedure: 'frequencies',
      summary: {
        table: [
          {
            title: 'How satisfied are you?',
            rows: [
              { value: 'Satisfied', frequency: 60, percent: 31.4 },
              { value: 'Very satisfied', frequency: 20, percent: 10.5 },
            ],
          },
        ],
      },
    });
    expect(fromRows.base).toBe('Base 80');
    const fromStats = resultViewFromToolResults({
      procedure: 'frequencies',
      summary: { stats: { n_valid: 191 } },
      frequency_tables: [
        {
          title: 'Frequency Table: Satisfaction',
          columns: ['', 'Frequency', 'Valid Percent'],
          rows: [
            ['Satisfied', '60', '31.4'],
            ['Very satisfied', '20', '10.5'],
            ['Missing', '58', ''],
            ['Total', '249', '100'],
          ],
        },
      ],
    });
    expect(fromStats.base).toBe('Base 191');
    expect(resultFootnote(fromStats, '', 'Frequencies')).toBe(
      'Base 191 · Unweighted · Frequencies'
    );
  });

  it('renders a descriptives result as means, not a frequency of the scale', () => {
    const fromSummary = resultViewFromToolResults({
      procedure: 'descriptives',
      summary: {
        table: [{ label: 'Satisfaction', mean: 3.4, sd: 1.1, median: 3, min: 1, max: 5, n: 800 }],
      },
      frequency_tables: [
        {
          title: 'Frequency Table: Satisfaction',
          columns: ['', 'Frequency', 'Valid Percent'],
          rows: [['Satisfied', '60', '31.4']],
        },
      ],
    });
    expect(fromSummary.tables).toEqual([
      {
        title: 'Descriptives',
        columns: ['Variable', 'Mean', 'SD', 'Median', 'Min', 'Max', 'n'],
        rows: [['Satisfaction', '3.4', '1.1', '3', '1', '5', '800']],
      },
    ]);
    const fromDescribe = resultViewFromToolResults({
      describe: {
        mean: { sat: 3.41 },
        std: { sat: 1.102 },
        '50%': { sat: 3 },
        min: { sat: 1 },
        max: { sat: 5 },
        count: { sat: 800 },
      },
    });
    expect(fromDescribe.tables[0].columns).toEqual([
      'Variable',
      'Mean',
      'SD',
      'Median',
      'Min',
      'Max',
      'n',
    ]);
    expect(fromDescribe.tables[0].rows[0][0]).toBe('sat');
    const labelled = resultViewFromToolResults({
      procedure: 'descriptives',
      describe: {
        mean: { sat: 3.41 },
        std: { sat: 1.102 },
        '50%': { sat: 3 },
        min: { sat: 1 },
        max: { sat: 5 },
        count: { sat: 800 },
      },
      variable_labels: { sat: 'Satisfaction' },
      result: {
        frequency_tables: [
          {
            title: 'Frequency Table: Satisfaction',
            columns: ['', 'Frequency', 'Valid Percent'],
            rows: [['High', '1', '100']],
          },
        ],
      },
    });
    expect(labelled.tables).toHaveLength(1);
    expect(labelled.tables[0].rows[0][0]).toBe('Satisfaction');
    expect(fromDescribe.tables[0].rows[0][1]).toBe('3.41');
  });

  it('renders NPS as shares, not the raw group dump', () => {
    const view = resultViewFromToolResults({
      groups: [{ group: 'London', n: 100, promoters: 50, passives: 30, detractors: 20, nps: 30 }],
    });
    expect(view.tables[0]).toEqual({
      title: 'NPS',
      columns: ['Group', 'NPS', '% promoters', '% passives', '% detractors', 'n'],
      rows: [['London', '30', '50.0', '30.0', '20.0', '100']],
    });
    const rounded = resultViewFromToolResults({
      groups: [
        {
          group: '1',
          label: 'North',
          n: 100,
          promoters: 20,
          passives: 30,
          detractors: 50,
          nps: -43.979,
        },
      ],
    });
    expect(rounded.tables[0].rows[0]).toEqual(['North', '-44', '20.0', '30.0', '50.0', '100']);
  });

  it('prints a label when a header is an object, and keeps the R check', () => {
    const view = resultViewFromToolResults({
      tables: [
        {
          title: 'By area',
          columns: [{ label: 'Area' }, { label: 'East' }],
          rows: [['High', 4]],
        },
      ],
      statistic: 2.2,
      p_value: 0.03,
      r_syntax_verification: { kind: 'verified', statement: 'The displayed figure matches R.' },
    });
    expect(view.tables[0].columns).toEqual(['Area', 'East']);
    const flat = view.tables.flatMap(table => [...table.columns, ...table.rows.flat()]);
    expect(flat.join(' ')).not.toContain('[object Object]');
    expect(view.rCheck).toBe('verified');
    expect(view.rStatement).toContain('matches R');
  });

  it('skips the syntax dump and keeps a finished R check over a pending one', () => {
    const view = resultViewFromToolResults({
      r_syntax_verification: { kind: 'pending', statement: 'R syntax is being checked.' },
      tables: [
        {
          id: 'equivalent_syntax',
          title: 'Equivalent R and SPSS syntax',
          columns: ['System', 'Syntax'],
          rows: [
            ['R', 'table(x)'],
            ['SPSS', ''],
          ],
        },
        {
          title: 'Aware',
          columns: ['Answer', 'Percent'],
          rows: [['Yes', '87.0']],
        },
      ],
      report: {
        r_syntax_verification: { kind: 'verified', statement: 'The displayed figure matches R.' },
      },
    });
    expect(view.tables.map(table => table.title)).toEqual(['Aware']);
    expect(view.rCheck).toBe('verified');
    expect(view.rStatement).toContain('matches R');
  });

  it('puts the column-letter test in the footnote and keeps the R script', () => {
    const view = resultViewFromToolResults({
      procedure: 'banner_table',
      r_syntax: 'cat(sprintf("n=%.16g\\n", nrow(df)))',
      r_syntax_verification: { kind: 'verified', statement: 'Re-derived 2 column letters.' },
      summary: {
        letter_test: 'Column letters at 95%.',
        table: [
          {
            title: 'Satisfaction by region',
            columns: ['Stub', 'North (A)', 'South (B)'],
            rows: [['Satisfied', '40.0%', '55.0% A']],
          },
        ],
      },
    });
    expect(view.tables[0].rows[0]).toContain('55.0% A');
    expect(view.letterNote).toBe('Column letters at 95%.');
    expect(resultFootnote(view, 'Base 191', 'Crosstab')).toContain('Column letters at 95%.');
    expect(view.rCheck).toBe('verified');
    expect(view.script).toContain('nrow(df)');
  });

  it('shows the new column and not a preview of the whole file', () => {
    const view = resultViewFromToolResults({
      derived: {
        preview: {
          headers: ['id', 'region'],
          variable_names: ['id', 'region'],
          columns: ['id', 'region'],
          rows: [['1', 'North']],
        },
      },
      summary: {
        title: 'Value for money: Agree or above',
        table: [
          {
            title: 'Value for money: Agree or above',
            rows: [
              { label: 'Agree or above', frequency: 2, percent: 50 },
              { label: 'Below agree', frequency: 2, percent: 50 },
            ],
          },
        ],
      },
    });
    expect(view.tables.map(table => table.title)).toEqual(['Value for money: Agree or above']);
    expect(view.tables[0].rows[0][0]).toBe('Agree or above');
    expect(weightNote('none')).toBe('Unweighted');
  });

  it('shows an association table, the filter, and the weight column', () => {
    const view = resultViewFromToolResults({
      request_body: {
        filter_ref: { combine: 'and', filters: [{ column: 'city', op: '=', value: 'London' }] },
        weight_column: 'design_weight',
      },
      summary: {
        notes: ['Expected counts under 5: 1 cell.'],
        table: [
          {
            title: 'Observed',
            columns: ['Region', 'North', 'South'],
            rows: [
              ['Yes', '10', '2'],
              ['No', '4', '8'],
            ],
          },
          {
            title: 'Effect size',
            columns: ['Measure', 'Value'],
            rows: [["Cramér's V", '0.250']],
          },
        ],
      },
    });
    expect(view.tables.map(table => table.title)).toEqual(['Observed', 'Effect size']);
    expect(view.tables[0].rows[0]).toEqual(['Yes', '10', '2']);
    expect(view.filter).toBe('city = London');
    expect(view.weight).toBe('design_weight');
    expect(view.checks).toContain('Expected counts under 5: 1 cell.');
    expect(resultFootnote(view, 'Base 24', 'Chi-square')).toContain('Filter: city = London');
    expect(resultFootnote(view, 'Base 24', 'Chi-square')).toContain('Weight: design_weight');
  });
});

describe('mean comparison tables', () => {
  it('shows the ANOVA source, the pairs, and Levene with the group means', () => {
    const view = resultViewFromToolResults({
      result: {
        f_statistic: 6.2,
        p_value: 0.004,
        eta_squared: 0.18,
        anova_table: {
          ss_between: 12.4,
          df_between: 2,
          ms_between: 6.2,
          ss_within: 40,
          df_within: 27,
          ms_within: 1.48,
        },
        group_descriptives: [{ group: 'A', n: 10, mean: 4.2, std: 1.1 }],
        post_hoc: {
          method: 'tukey',
          pairwise: [{ group1: 'A', group2: 'B', meandiff: 1.2, 'p-adj': 0.01 }],
        },
        levene_test: { p_value: 0.42 },
      },
    });
    expect(view.tables.map(table => table.title)).toEqual([
      'Group means',
      'ANOVA',
      'Post hoc (tukey)',
    ]);
    expect(view.tables[1].rows[0][0]).toBe('Between groups');
    expect(view.tables[2].rows[0].slice(0, 2)).toEqual(['A', 'B']);
    expect(view.checks).toContain('Levene p = 0.42');
  });

  it('keeps one labelled group table when the export repeats it', () => {
    const view = resultViewFromToolResults({
      result: {
        group_descriptives: [
          {
            group: '2.0',
            label: 'Female',
            n: 10,
            unweighted_n: 10,
            weighted_n: 12.4,
            mean: 4.2,
            std: 1.1,
          },
          {
            group: '1.0',
            label: 'Male',
            n: 8,
            unweighted_n: 8,
            weighted_n: 9.1,
            mean: 3.1,
            std: 0.9,
          },
        ],
        post_hoc: {
          method: 'tukey',
          pairwise: [{ group1: '2.0', group2: '1.0', meandiff: 1.1, 'p-adj': 0.03 }],
        },
      },
      report: {
        spss_blocks: [
          {
            id: 'group_statistics',
            title: 'Group Statistics',
            columns: ['score', 'N', 'Mean', 'Std. Deviation'],
            rows: [
              ['2.0', '10', '4.2', '1.1'],
              ['1.0', '8', '3.1', '0.9'],
            ],
          },
        ],
        tables: [
          {
            id: 'ttest_groups',
            title: 'Satisfaction by Gender',
            columns: ['Group', 'Unweighted n', 'Weighted n', 'Mean', 'SD'],
            rows: [
              ['Female', '10', '12.4', '4.2', '1.1'],
              ['Male', '8', '9.1', '3.1', '0.9'],
            ],
          },
        ],
      },
    });
    const groups = view.tables.filter(table => table.columns.includes('Mean'));
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Satisfaction by Gender');
    expect(groups[0].rows.map(row => row[0])).toEqual(['Female', 'Male']);
    expect(groups[0].columns).not.toContain('score');
    const pairs = view.tables.find(table => table.title.startsWith('Post hoc'));
    expect(pairs?.rows[0].slice(0, 2)).toEqual(['Female', 'Male']);
  });
});

describe('answer tables', () => {
  it('rounds share cells and drops nothing else', () => {
    const tables = answerResultTables(
      [
        'People in the subset.',
        '',
        '| Group | Share |',
        '| --- | --- |',
        '| First | 2.410% |',
        '| Second | 12.048 |',
        '| Third | 30.120% |',
      ].join('\n')
    );
    expect(tables).toHaveLength(1);
    expect(tables[0].rows.map(row => row[1])).toEqual(['2.4%', '12.0', '30.1%']);
    expect(tables[0].title).toBe('');
  });

  it('leaves a mean column at the decimals it was given', () => {
    const tables = answerResultTables(
      ['| Group | Mean |', '| --- | --- |', '| First | 4.256 |'].join('\n')
    );
    expect(tables[0].rows[0][1]).toBe('4.256');
  });
});
