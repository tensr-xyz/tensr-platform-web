import {
  bannerFootnote,
  bannerHeading,
  chartFromBannerSeries,
  chartSeriesFromBook,
  chartSignificanceNote,
  codedStub,
  concatenateLetters,
  efficiencyPercent,
  lettersFor,
  mediaCellLines,
  mediaCellText,
  selectionFromCell,
} from './flow-survey';

describe('flow survey grid', () => {
  it('prefers the value label over a stored banner code', () => {
    expect(
      bannerHeading({
        id: 'region=1',
        label: 'East',
        codes: [{ code: '1' }],
      })
    ).toBe('East');
    expect(bannerHeading({ id: 'region=1', codes: [{ code: '1' }] })).toBe('1');
  });

  it('treats a coded open end as a multi-response stub', () => {
    expect(codedStub('open_end_codes')).toEqual({
      column: 'open_end_codes',
      multiple_response: true,
      value_delimiter: '|',
    });
    expect(codedStub('sat_reason_themes')).toEqual({
      column: 'sat_reason_themes',
      multiple_response: true,
      value_delimiter: '|',
    });
    expect(codedStub('custom_themes', { coded_multi: true, code_delimiter: '|' })).toEqual({
      column: 'custom_themes',
      multiple_response: true,
      value_delimiter: '|',
    });
    expect(codedStub('measure')).toEqual({ column: 'measure' });
  });

  it('keeps the cell percent, base, and n for the evidence drill', () => {
    const selected = selectionFromCell(
      { resolved_weight: 'weight', run_id: 'run-slim-1' },
      { id: 'row-1', label: 'Theme', source_text_column: 'open_end' },
      {
        banner_id: 'total',
        stub_row_id: 'row-1',
        percent: 25,
        unweighted_n: 4,
        column_unweighted_n: 12,
        provenance: { row_uid_bitset: 'bitset' },
      },
      'A'
    );
    expect(selected).toMatchObject({
      percent: '25.0%',
      n: '4',
      base: '12',
      weight: 'weight',
      textColumn: 'open_end',
      bitset: 'bitset',
      letter: 'A',
      runId: 'run-slim-1',
      stubRowId: 'row-1',
      bannerId: 'total',
    });
  });

  it('uses an origin bitset when the cell does not carry one of its own', () => {
    const selected = selectionFromCell(
      {},
      { id: 'row-1', label: 'Theme', column: 'open_end' },
      {
        banner_id: 'total',
        percent: 10,
        unweighted_n: 2,
        column_unweighted_n: 8,
        provenance: { origin_bitsets: { origin: { row_uid_bitset: 'abc' } } },
      }
    );
    expect(selected?.bitset).toBe('abc');
    expect(selected?.percent).toBe('10.0%');
  });

  it('keeps the cell claim when provenance says the bitset is unavailable', () => {
    const selected = selectionFromCell(
      {},
      { id: 'row-1', label: 'Theme', column: 'open_end' },
      {
        banner_id: 'total',
        percent: 10,
        unweighted_n: 2,
        column_unweighted_n: 8,
        provenance: {
          provenance_unavailable: 'unknown_row_uids',
          origin_bitsets: { origin: { row_uid_bitset: 'abc' } },
        },
      }
    );
    expect(selected?.bitset).toBe('');
    expect(selected?.n).toBe('2');
  });

  it('names a selected banner column by the variable label', () => {
    expect(
      bannerHeading({
        id: 'member=1',
        label: 'Selected',
        column_label: 'Member role',
        letter_slot: 'b',
      })
    ).toBe('Member role');
  });

  it('names a bare code-1 banner column by the variable label', () => {
    expect(
      bannerHeading({
        id: 'inv=1',
        label: '1',
        column_label: 'Institutional investor',
        letter_slot: 'A',
      })
    ).toBe('Institutional investor');
    expect(
      bannerHeading(
        {
          id: 'inv=1',
          label: '1.0',
          letter_slot: 'A',
        },
        'US institutional investors'
      )
    ).toBe('US institutional investors');
    // Audience wording wins over a column_label that is still the variable name.
    expect(
      bannerHeading(
        {
          id: 'inv=1',
          label: '1',
          column_label: 'inv_institutional',
          codes: [{ column: 'inv_institutional', code: '1' }],
          letter_slot: 'A',
        },
        'US institutional investors'
      )
    ).toBe('US institutional investors');
  });

  it('shows rake efficiency as a percent', () => {
    expect(efficiencyPercent(0.82)).toBe('82.0%');
  });

  it('concatenates column letters in A–Z order and drops McNemar when mixed', () => {
    expect(concatenateLetters(['C', 'a', 'A', 'B', 'e'])).toBe('ABCe');
    expect(
      lettersFor(
        [
          { stub_row_id: 'yes', banner_id: 'london', letter: 'A', comparison_type: 'column_pair' },
          { stub_row_id: 'yes', banner_id: 'london', letter: 'e', comparison_type: 'column_pair' },
          { stub_row_id: 'yes', banner_id: 'london', letter: 'B', comparison_type: 'paired_item' },
          { stub_row_id: 'yes', banner_id: 'london', letter: 'C', comparison_type: 'column_pair' },
        ],
        'yes',
        'london'
      )
    ).toBe('ACe');
  });

  it('shows projected thousands and index beside the column percent only when toggled on', () => {
    expect(
      mediaCellText({
        banner_id: 'total',
        percent: 39.4,
        projected_thousands: 102.6,
        index: 131.2,
      })
    ).toBe('39.4%');
    expect(
      mediaCellText(
        {
          banner_id: 'total',
          percent: 39.4,
          projected_thousands: 102.6,
          index: 131.2,
        },
        'percent',
        1,
        { includeProjected: true, includeIndex: true }
      )
    ).toBe('39.4% · 102.6k · idx 131');
    expect(
      mediaCellText(
        {
          banner_id: 'total',
          percent: 69.0,
          projected_thousands: 2678.957,
          index: 100,
        },
        'percent',
        1,
        { includeProjected: true, includeIndex: true }
      )
    ).toBe('69.0% · 2,679k · idx 100');
    expect(
      mediaCellText(
        {
          banner_id: 'total',
          percent: 69.0,
          projected_thousands: 2678.957,
          index: 100,
        },
        'percent',
        1,
        { includeProjected: false, includeIndex: false }
      )
    ).toBe('69.0%');
  });

  it('names the paired McNemar test when brands are compared inside a column', () => {
    expect(
      bannerFootnote({
        paired_within_items: true,
        letter_test: 'Paired McNemar test at 95%.',
        significance_display: 'column_letters',
        letters: [{ stub_row_id: 'a:1', banner_id: 'total', letter: 'B' }],
      })
    ).toContain('Paired McNemar test at 95%');
  });

  it('still names Paired McNemar when no lettered cell survived and display is none', () => {
    expect(
      bannerFootnote({
        paired_within_items: true,
        letter_test: 'Paired McNemar test at 95%.',
        significance_display: 'none',
        letters: [],
      })
    ).toContain('Paired McNemar test at 95%');
  });

  it('stacks reach cell lines like Paper 5d (percent, projected+index, n) when toggled', () => {
    expect(
      mediaCellLines(
        {
          banner_id: 'total',
          percent: 42.0,
          projected_thousands: 1014.2,
          index: 105,
          unweighted_n: 212,
        },
        1,
        { includeProjected: true, includeIndex: true, includeUnweighted: true }
      )
    ).toEqual({
      percent: '42.0%',
      detail: '1,014k · idx 105',
      base: 'n 212',
    });
    expect(
      mediaCellLines({
        banner_id: 'total',
        percent: 42.0,
        projected_thousands: 1014.2,
        index: 105,
        unweighted_n: 212,
      })
    ).toEqual({
      percent: '42.0%',
      detail: '',
      base: '',
    });
  });

  it('charts the same banner cells as grouped bars, and remaps to line or pie', () => {
    const book = {
      banner_columns: [
        { id: 'total', label: 'Total' },
        { id: 'east', label: 'East' },
        { id: 'north', label: 'North' },
      ],
      rows: [
        {
          id: 'yes',
          label: 'Yes',
          kind: 'value',
          cells: [
            { banner_id: 'total', percent: 50 },
            { banner_id: 'east', percent: 60 },
            { banner_id: 'north', percent: 40 },
          ],
        },
        {
          id: 'no',
          label: 'No',
          kind: 'value',
          cells: [
            { banner_id: 'total', percent: 50 },
            { banner_id: 'east', percent: 40 },
            { banner_id: 'north', percent: 60 },
          ],
        },
        {
          id: 'base',
          label: 'Base',
          kind: 'base',
          cells: [{ banner_id: 'east', unweighted_n: 100 }],
        },
      ],
    };
    const series = chartSeriesFromBook(book);
    expect(series).toEqual([
      {
        label: 'Yes',
        values: [
          { name: 'East', value: 60 },
          { name: 'North', value: 40 },
        ],
      },
      {
        label: 'No',
        values: [
          { name: 'East', value: 40 },
          { name: 'North', value: 60 },
        ],
      },
    ]);

    const bars = chartFromBannerSeries(series, 'bar', { title: 'Awareness' });
    expect(bars).toMatchObject({
      kind: 'bar_grouped',
      title: 'Awareness',
      categories: ['East', 'North'],
      series: [
        { name: 'Yes', values: [60, 40] },
        { name: 'No', values: [40, 60] },
      ],
    });

    expect(chartFromBannerSeries(series, 'line')?.kind).toBe('line');
    expect(chartFromBannerSeries(series, 'area')?.kind).toBe('area');

    expect(chartFromBannerSeries(series, 'stacked', { title: 'Awareness' })).toMatchObject({
      kind: 'bar_stacked',
      title: 'Awareness',
      categories: ['East', 'North'],
      series: [
        { name: 'Yes', values: [60, 40] },
        { name: 'No', values: [40, 60] },
      ],
    });
    expect(chartFromBannerSeries(series, 'stacked_100')).toMatchObject({
      kind: 'bar_stacked_100',
      y_label: 'Percent',
    });
    expect(chartFromBannerSeries(series, 'horizontal')).toMatchObject({
      kind: 'bar_horizontal',
      x_label: 'Percent',
      categories: ['East', 'North'],
    });

    const ranked = chartFromBannerSeries(series, 'ranked', {
      title: 'Reach',
      highlightAnswer: 'No',
      accent: '#1E6B58',
      muted: '#CFCFCB',
    });
    expect(ranked).toMatchObject({
      kind: 'bar_horizontal',
      title: 'Reach',
      data_labels: true,
      highlight_category: 'No',
      // Sorted by East % descending: Yes 60, No 40 — highlight stays on No.
      categories: ['Yes', 'No'],
      series: [{ name: 'East', values: [60, 40] }],
      category_fills: ['#CFCFCB', '#1E6B58'],
    });

    const pie = chartFromBannerSeries(series, 'pie', { title: 'Awareness' });
    expect(pie).toEqual({
      kind: 'pie',
      title: 'Awareness',
      categories: ['Yes', 'No'],
      values: [60, 40],
    });

    expect(chartFromBannerSeries(series, 'donut', { title: 'Awareness' })).toEqual({
      kind: 'donut',
      title: 'Awareness',
      categories: ['Yes', 'No'],
      values: [60, 40],
    });

    const single = chartFromBannerSeries([series[0]!], 'pie');
    expect(single).toEqual({
      kind: 'pie',
      title: '',
      categories: ['East', 'North'],
      values: [60, 40],
    });
  });

  it('carries the same column letters onto bar, stacked, horizontal, line, area, pie and donut charts', () => {
    const book = {
      significance_display: 'letters',
      letter_test: 'Column proportions test at 95%',
      banner_columns: [
        { id: 'total', label: 'Total' },
        { id: 'east', label: 'region=East', letter_slot: 'A' },
        { id: 'north', label: 'region=North', letter_slot: 'B' },
      ],
      letters: [{ stub_row_id: 'yes', banner_id: 'east', letter: 'B' }],
      rows: [
        {
          id: 'yes',
          label: 'Yes',
          kind: 'value',
          cells: [
            { banner_id: 'east', percent: 60 },
            { banner_id: 'north', percent: 40 },
          ],
        },
        {
          id: 'no',
          label: 'No',
          kind: 'value',
          cells: [
            { banner_id: 'east', percent: 40 },
            { banner_id: 'north', percent: 60 },
          ],
        },
      ],
    };
    const series = chartSeriesFromBook(book);
    expect(series[0]?.values[0]).toEqual({ name: 'East', value: 60, letter: 'B' });
    expect(series[0]?.values[1]).toEqual({ name: 'North', value: 40 });
    expect(chartSignificanceNote(book)).toBe('Column proportions test at 95%');

    const note = chartSignificanceNote(book);
    const bars = chartFromBannerSeries(series, 'bar', {
      title: 'Awareness',
      significanceNote: note,
    });
    expect(bars).toMatchObject({
      kind: 'bar_grouped',
      significance_note: 'Column proportions test at 95%',
      series: [
        { name: 'Yes', values: [60, 40], letters: ['B', ''] },
        { name: 'No', values: [40, 60] },
      ],
    });
    expect(chartFromBannerSeries(series, 'line', { significanceNote: note })).toMatchObject({
      kind: 'line',
      series: [{ name: 'Yes', letters: ['B', ''] }, { name: 'No' }],
      significance_note: note,
    });
    expect(chartFromBannerSeries(series, 'area', { significanceNote: note })).toMatchObject({
      kind: 'area',
      series: [{ name: 'Yes', letters: ['B', ''] }, { name: 'No' }],
    });

    expect(chartFromBannerSeries(series, 'stacked', { significanceNote: note })).toMatchObject({
      kind: 'bar_stacked',
      series: [{ name: 'Yes', letters: ['B', ''] }, { name: 'No' }],
    });
    expect(chartFromBannerSeries(series, 'horizontal', { significanceNote: note })).toMatchObject({
      kind: 'bar_horizontal',
      series: [{ name: 'Yes', letters: ['B', ''] }, { name: 'No' }],
    });
    expect(
      chartFromBannerSeries(series, 'ranked', {
        significanceNote: note,
        highlightAnswer: 'Yes',
      })
    ).toMatchObject({
      kind: 'bar_horizontal',
      data_labels: true,
      highlight_category: 'Yes',
      series: [{ letters: ['B', ''] }],
      significance_note: note,
    });

    const pie = chartFromBannerSeries([series[0]!], 'pie', { significanceNote: note });
    expect(pie).toMatchObject({
      kind: 'pie',
      categories: ['East', 'North'],
      values: [60, 40],
      letters: ['B', ''],
      significance_note: note,
    });
    expect(chartFromBannerSeries([series[0]!], 'donut', { significanceNote: note })).toMatchObject({
      kind: 'donut',
      letters: ['B', ''],
      significance_note: note,
    });
  });

  it('omits chart letters when significance display is off', () => {
    const book = {
      significance_display: 'none',
      banner_columns: [
        { id: 'east', label: 'East', letter_slot: 'A' },
        { id: 'north', label: 'North', letter_slot: 'B' },
      ],
      letters: [{ stub_row_id: 'yes', banner_id: 'east', letter: 'B' }],
      rows: [
        {
          id: 'yes',
          label: 'Yes',
          kind: 'value',
          cells: [
            { banner_id: 'east', percent: 60 },
            { banner_id: 'north', percent: 40 },
          ],
        },
      ],
    };
    expect(chartSeriesFromBook(book)[0]?.values[0]).toEqual({ name: 'East', value: 60 });
    expect(chartSignificanceNote(book)).toBeUndefined();
  });
});

describe('theme read', () => {
  it('names the largest theme and the largest significant segment gap', () => {
    const { themeRead } = jest.requireActual('./flow-survey');
    const book = {
      banner_columns: [
        { id: 'total', label: 'Total' },
        { id: 'r=E', label: 'region=East', letter_slot: 'A' },
        { id: 'r=N', label: 'region=North', letter_slot: 'B' },
      ],
      letters: [{ stub_row_id: 'price', banner_id: 'r=E', letter: 'B' }],
      rows: [
        {
          id: 'price',
          label: 'Price',
          kind: 'value',
          cells: [
            { banner_id: 'total', percent: 31 },
            { banner_id: 'r=E', percent: 40 },
            { banner_id: 'r=N', percent: 22 },
          ],
        },
        {
          id: 'staff',
          label: 'Staff',
          kind: 'value',
          cells: [{ banner_id: 'total', percent: 12 }],
        },
      ],
    };
    const read = themeRead(book);
    expect(read.text).toBe(
      'Price is the largest theme, at 31% overall. Price is higher in East (40%) than North (22%) at 95%.'
    );
    expect(read.bannerId).toBe('r=E');
  });
});
