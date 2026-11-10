import { resultFootnote, resultViewFromToolResults } from './result-tables';

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
      'Count',
      '% of people who answered',
      'Weighted %',
      'Quote',
    ]);
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
});
