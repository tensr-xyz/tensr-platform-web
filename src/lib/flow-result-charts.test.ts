import {
  chartFromBannerBook,
  chartFromFrequencyTables,
  chartsFromToolPayloads,
} from '@/lib/flow-result-charts';

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

  it('TEN-93: keeps one boxplot when Weighted and plain titles both land', () => {
    const charts = chartsFromToolPayloads([
      {
        report: {
          charts: [
            {
              kind: 'boxplot',
              title: 'Trust in brand by Gender',
              y_label: 'Trust in brand',
              groups: [{ label: 'Male' }, { label: 'Female' }],
            },
            {
              kind: 'boxplot',
              title: 'Weighted Trust in brand by Gender',
              y_label: 'Trust in brand',
              groups: [{ label: 'Male' }, { label: 'Female' }],
            },
          ],
        },
      },
    ]);
    expect(charts).toHaveLength(1);
    expect(charts[0].title).toBe('Weighted Trust in brand by Gender');
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

  it('derives a side-by-side yes% chart from a brand-grid banner book', () => {
    const book = {
      title: 'Brand awareness',
      weight: { column: 'w', weight_aware: true },
      column_metadata: {
        aware_a: { label: 'BrewCo', value_labels: { '0': 'No', '1': 'Yes' } },
        aware_b: { label: 'BeanHouse', value_labels: { '0': 'No', '1': 'Yes' } },
        aware_c: { label: 'Cuppa', value_labels: { '0': 'No', '1': 'Yes' } },
      },
      banner_columns: [{ id: 'total', label: 'Total' }],
      rows: [
        {
          id: 'aware_a:0',
          column: 'aware_a',
          label: '0',
          kind: 'value',
          cells: [{ banner_id: 'total', percent: 30 }],
        },
        {
          id: 'aware_a:1',
          column: 'aware_a',
          label: '1',
          kind: 'value',
          cells: [{ banner_id: 'total', percent: 70 }],
        },
        {
          id: 'aware_b:0',
          column: 'aware_b',
          label: '0',
          kind: 'value',
          cells: [{ banner_id: 'total', percent: 48.3 }],
        },
        {
          id: 'aware_b:1',
          column: 'aware_b',
          label: '1',
          kind: 'value',
          cells: [{ banner_id: 'total', percent: 51.7 }],
        },
        {
          id: 'aware_c:0',
          column: 'aware_c',
          label: '0',
          kind: 'value',
          cells: [{ banner_id: 'total', percent: 33.3 }],
        },
        {
          id: 'aware_c:1',
          column: 'aware_c',
          label: '1',
          kind: 'value',
          cells: [{ banner_id: 'total', percent: 66.7 }],
        },
      ],
    };
    expect(chartFromBannerBook(book, 'weighted')).toMatchObject({
      kind: 'bar_grouped',
      categories: ['BrewCo', 'BeanHouse', 'Cuppa'],
      series: [{ name: 'Yes', values: [70, 51.7, 66.7] }],
      weighting: 'weighted',
    });
    const charts = chartsFromToolPayloads({ result: book });
    expect(charts[0]?.categories).toEqual(['BrewCo', 'BeanHouse', 'Cuppa']);
    expect(charts[0]?.categories).not.toContain('aware_a');
  });

  it('derives grouped bars by demographic host for a brand-grid banner', () => {
    const book = {
      title: 'Brand awareness by gender',
      weight: { column: 'w', weight_aware: true },
      column_metadata: {
        aware_a: { label: 'BrewCo', value_labels: { '0': 'No', '1': 'Yes' } },
        aware_b: { label: 'BeanHouse', value_labels: { '0': 'No', '1': 'Yes' } },
        aware_c: { label: 'Cuppa', value_labels: { '0': 'No', '1': 'Yes' } },
      },
      banner_columns: [
        { id: 'total', label: 'Total' },
        { id: 'gender=Men', label: 'Men' },
        { id: 'gender=Women', label: 'Women' },
      ],
      rows: [
        {
          column: 'aware_a',
          label: '1',
          kind: 'value',
          cells: [
            { banner_id: 'total', percent: 71.1 },
            { banner_id: 'gender=Men', percent: 69.3 },
            { banner_id: 'gender=Women', percent: 72.9 },
          ],
        },
        {
          column: 'aware_a',
          label: '0',
          kind: 'value',
          cells: [
            { banner_id: 'total', percent: 28.9 },
            { banner_id: 'gender=Men', percent: 30.7 },
            { banner_id: 'gender=Women', percent: 27.1 },
          ],
        },
        {
          column: 'aware_b',
          label: '1',
          kind: 'value',
          cells: [
            { banner_id: 'total', percent: 50 },
            { banner_id: 'gender=Men', percent: 48 },
            { banner_id: 'gender=Women', percent: 52 },
          ],
        },
        {
          column: 'aware_b',
          label: '0',
          kind: 'value',
          cells: [
            { banner_id: 'total', percent: 50 },
            { banner_id: 'gender=Men', percent: 52 },
            { banner_id: 'gender=Women', percent: 48 },
          ],
        },
        {
          column: 'aware_c',
          label: '1',
          kind: 'value',
          cells: [
            { banner_id: 'total', percent: 40 },
            { banner_id: 'gender=Men', percent: 35 },
            { banner_id: 'gender=Women', percent: 45 },
          ],
        },
        {
          column: 'aware_c',
          label: '0',
          kind: 'value',
          cells: [
            { banner_id: 'total', percent: 60 },
            { banner_id: 'gender=Men', percent: 65 },
            { banner_id: 'gender=Women', percent: 55 },
          ],
        },
      ],
    };
    expect(chartFromBannerBook(book, 'weighted')).toMatchObject({
      kind: 'bar_grouped',
      categories: ['BrewCo', 'BeanHouse', 'Cuppa'],
      series: [
        { name: 'Men', values: [69.3, 48, 35] },
        { name: 'Women', values: [72.9, 52, 45] },
      ],
      weighting: 'weighted',
    });
  });
});
