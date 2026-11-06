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
    expect(views[1].tables[0].columns).toEqual(['Theme', 'Count', '%', 'Example']);
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
});
