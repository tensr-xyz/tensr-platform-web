import { chartFromFrequencyTables, chartsFromToolPayloads } from '@/lib/flow-result-charts';

describe('flow result charts', () => {
  it('builds a side-by-side yes% chart from several awareness frequency tables', () => {
    const chart = chartFromFrequencyTables(
      [
        {
          title: 'Frequency Table: BrewCo',
          columns: ['', 'Frequency', 'Percent', 'Valid Percent', 'Cumulative Percent'],
          rows: [
            ['No', '30', '30', '30', '30'],
            ['Yes', '70', '70', '70', '100'],
            ['Total', '100', '100', '100', ''],
          ],
        },
        {
          title: 'Frequency Table: BeanHouse',
          columns: ['', 'Frequency', 'Percent', 'Valid Percent', 'Cumulative Percent'],
          rows: [
            ['No', '45', '45', '45', '45'],
            ['Yes', '55', '55', '55', '100'],
            ['Total', '100', '100', '100', ''],
          ],
        },
        {
          title: 'Frequency Table: Cuppa',
          columns: ['', 'Frequency', 'Percent', 'Valid Percent', 'Cumulative Percent'],
          rows: [
            ['No', '33', '33', '33', '33'],
            ['Yes', '67', '67', '67', '100'],
            ['Total', '100', '100', '100', ''],
          ],
        },
      ],
      'weighted'
    );
    expect(chart).toMatchObject({
      kind: 'bar_grouped',
      categories: ['BrewCo', 'BeanHouse', 'Cuppa'],
      series: [{ name: 'Yes', values: [70, 55, 67] }],
      weighting: 'weighted',
    });
  });

  it('reads a chart from a stored analysis report on the tool result', () => {
    const charts = chartsFromToolPayloads([
      {
        ok: true,
        procedure: 'frequencies',
        result: {
          ok: true,
          report: {
            chart: {
              kind: 'bar_grouped',
              title: 'Region',
              x_label: 'Region',
              y_label: 'Valid percent',
              categories: ['North', 'South'],
              series: [{ name: 'Valid percent', values: [40, 60] }],
            },
          },
        },
      },
    ]);
    expect(charts).toHaveLength(1);
    expect(charts[0].title).toBe('Region');
  });

  it('derives a chart from frequency_tables when the report has none', () => {
    const charts = chartsFromToolPayloads({
      result: {
        frequency_tables: [
          {
            title: 'Frequency Table: Region',
            columns: ['Label', 'Count', '%', 'Valid %', 'Cumulative %'],
            rows: [
              ['North', '2', '40', '40', '40'],
              ['South', '3', '60', '60', '100'],
              ['Missing', '1', '20', '', ''],
              ['Total', '6', '100', '', ''],
            ],
          },
        ],
      },
    });
    expect(charts[0]).toMatchObject({
      kind: 'bar_grouped',
      title: 'Region',
      categories: ['North', 'South'],
      series: [{ values: [40, 60] }],
    });
    expect(charts[0].categories).not.toContain('Total');
    expect(charts[0].categories).not.toContain('Missing');
  });

  it('omits Total respondents from multi-select frequency charts', () => {
    const charts = chartsFromToolPayloads({
      result: {
        frequency_tables: [
          {
            title: 'Frequency Table: Topics',
            columns: ['Label', 'Count', '% of respondents'],
            multiple_response: true,
            mr_base: 'percent_of_respondents',
            rows: [
              ['General health', '5', '62.5'],
              ['Nutrition', '4', '50'],
              ['Total respondents', '8', '100'],
            ],
          },
        ],
      },
    });
    expect(charts[0].categories).toEqual(['General health', 'Nutrition']);
    expect(charts[0].categories).not.toContain('Total respondents');
    expect(charts[0].y_label).toBe('Percent of respondents');
    expect(charts[0].series?.[0]?.values).toEqual([62.5, 50]);
  });

  it('omits Base from multi-select frequency charts', () => {
    const charts = chartsFromToolPayloads({
      result: {
        frequency_tables: [
          {
            title: 'Frequency Table: Topics',
            columns: ['Label', 'Count', '% of respondents'],
            multiple_response: true,
            mr_base: 'percent_of_respondents',
            rows: [
              ['General health', '5', '62.5'],
              ['Nutrition', '4', '50'],
              ['Base', '8', '100'],
            ],
          },
        ],
      },
    });
    expect(charts[0].categories).toEqual(['General health', 'Nutrition']);
    expect(charts[0].categories).not.toContain('Base');
  });
});
