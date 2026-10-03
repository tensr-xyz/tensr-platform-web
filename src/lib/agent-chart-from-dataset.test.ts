import {
  buildChartFromDataset,
  isChartIntent,
  loadFilteredChartRows,
  PALETTE_MENU_TO_KIND,
  shouldRouteToInlineChart,
  weightedQuantile,
} from './agent-chart-from-dataset';

jest.mock('@/utils/auth', () => ({
  getIdToken: () => 'token',
}));

const columns = [
  { id: 'MP', header: 'MP' },
  { id: 'PTS', header: 'PTS' },
  { id: 'Age', header: 'Age' },
];

const rows = Array.from({ length: 20 }, (_, i) => ({
  MP: 20 + i,
  PTS: 10 + i * 2,
  Age: 22 + (i % 10),
}));

describe('agent chart from dataset', () => {
  it('detects chart intents', () => {
    expect(isChartIntent('Plot the correlation between minutes and points')).toBe(true);
    expect(isChartIntent('sort by age')).toBe(false);
  });

  it('routes plot prompts to inline charts, not analysis setup', () => {
    expect(shouldRouteToInlineChart('Plot the correlation between minutes and points')).toBe(true);
    expect(shouldRouteToInlineChart("What's the correlation between two numeric columns?")).toBe(
      false
    );
  });

  it('builds a boxplot instead of a scatter when asked for a boxplot', () => {
    const chart = buildChartFromDataset(
      'Make a boxplot of Age by group',
      [
        { id: 'Age', header: 'Age' },
        { id: 'group', header: 'group' },
      ],
      [
        ...Array.from({ length: 8 }, (_, i) => ({ Age: 20 + i, group: 'A' })),
        ...Array.from({ length: 8 }, (_, i) => ({ Age: 30 + i, group: 'B' })),
      ]
    );
    expect(chart?.kind).toBe('boxplot');
    expect(chart && 'groups' in chart ? chart.groups.length : 0).toBe(2);
  });

  it('builds scatter chart from minutes/points aliases', () => {
    const chart = buildChartFromDataset(
      'Plot the correlation between minutes and points',
      columns,
      rows
    );
    expect(chart?.kind).toBe('scatter');
    expect(chart?.x_label).toBe('MP');
    expect(chart?.y_label).toBe('PTS');
    expect(chart?.points?.length).toBeGreaterThan(1);
  });

  it('weights a histogram and sizes a weighted scatter by weight', () => {
    const weightedRows = [
      { score: 1, w: 1 },
      { score: 1, w: 0 },
      { score: 2, w: 3 },
    ];
    const cols = [
      { id: 'score', header: 'score' },
      { id: 'w', header: 'w' },
    ];
    const hist = buildChartFromDataset(
      'show the distribution',
      [{ id: 'score', header: 'score' }],
      weightedRows,
      'w'
    );
    expect(hist?.kind).toBe('histogram');
    expect(hist?.title).toContain('Weighted');
    const total = hist && 'bins' in hist ? hist.bins.reduce((sum, bin) => sum + bin.count, 0) : 0;
    expect(total).toBe(4);

    const scatter = buildChartFromDataset(
      'Plot the correlation between score and w',
      cols,
      weightedRows,
      'w'
    );
    expect(scatter?.kind).toBe('scatter');
    expect(scatter?.title).toBe('Weighted w vs score');
    expect(scatter && scatter.kind === 'scatter' ? scatter.points.map(p => p.weight) : []).toEqual([
      1, 3,
    ]);
  });

  it('matches survey hf7 weighted quartiles on a hand-checked example', () => {
    const pairs = [10, 1, 3, 2, 4].map((value, i) => ({ value, weight: [5, 1, 2, 1, 1][i]! }));
    expect(weightedQuantile(pairs, 0.25)).toBeCloseTo(2.25, 10);
    expect(weightedQuantile(pairs, 0.5)).toBeCloseTo(3.25, 10);
    expect(weightedQuantile(pairs, 0.75)).toBeCloseTo(3.875, 10);
    const equal = [3, 9, 6].map(value => ({ value, weight: 2 }));
    expect(weightedQuantile(equal, 0.25)).toBeCloseTo(4.5, 10);
  });

  it('titles and weights palette boxplots and scatters only when a weight is active', () => {
    const nbaRows = [
      { Pos: 'C', PTS: 7, AST: 1, w: 2 },
      { Pos: 'C', PTS: 8, AST: 2, w: 1 },
      { Pos: 'C', PTS: 9, AST: 2.5, w: 1.5 },
      { Pos: 'C', PTS: 10, AST: 3, w: 3 },
    ];
    const nbaColumns = [
      { id: 'Pos', header: 'Pos' },
      { id: 'PTS', header: 'PTS' },
      { id: 'AST', header: 'AST' },
      { id: 'w', header: 'w' },
    ];
    const box = buildChartFromDataset('boxplot', nbaColumns, nbaRows, 'w', {
      kind: 'boxplot',
      xId: 'Pos',
      yId: 'PTS',
    });
    expect(box?.title).toBe('Weighted PTS by Pos');
    expect(box?.weighting).toBe('weighted');
    const group = box && 'groups' in box ? box.groups[0]! : null;
    expect(group?.q1).toBeCloseTo(7.5625, 10);
    expect(group?.median).toBeCloseTo(8.25, 10);
    expect(group?.q3).toBeCloseTo(9.25, 10);

    const plainBox = buildChartFromDataset('boxplot', nbaColumns, nbaRows, null, {
      kind: 'boxplot',
      xId: 'Pos',
      yId: 'PTS',
    });
    expect(plainBox?.title).toBe('PTS by Pos');
    expect(plainBox && 'groups' in plainBox ? plainBox.groups[0]!.median : null).toBeCloseTo(
      8.5,
      10
    );

    const scatter = buildChartFromDataset('scatter', nbaColumns, nbaRows, 'w', {
      kind: 'scatter',
      xId: 'AST',
      yId: 'PTS',
    });
    expect(scatter?.title).toBe('Weighted PTS vs AST');
    expect(scatter && scatter.kind === 'scatter' ? scatter.point_size : null).toBe('weight');
    expect(scatter && scatter.kind === 'scatter' ? scatter.points.map(p => p.weight) : []).toEqual([
      2, 1, 1.5, 3,
    ]);

    const plainScatter = buildChartFromDataset('scatter', nbaColumns, nbaRows, null, {
      kind: 'scatter',
      xId: 'AST',
      yId: 'PTS',
    });
    expect(plainScatter?.title).toBe('PTS vs AST');
    expect(
      plainScatter && plainScatter.kind === 'scatter' ? plainScatter.point_size : 'x'
    ).toBeUndefined();
  });

  const paletteColumns = [
    { id: 'Pos', header: 'Pos' },
    { id: 'PTS', header: 'PTS' },
    { id: 'Age', header: 'Age' },
  ];
  const paletteRows = [
    { Pos: 'G', PTS: 10, Age: 22 },
    { Pos: 'G', PTS: 20, Age: 24 },
    { Pos: 'F', PTS: 30, Age: 28 },
    { Pos: 'C', PTS: 12, Age: 26 },
  ];

  it.each(['bar', 'line', 'pie', 'area', 'scatter', 'histogram', 'boxplot'] as const)(
    'builds a %s chart as that kind',
    kind => {
      const chart = buildChartFromDataset(
        `${kind} chart of PTS by Pos`,
        paletteColumns,
        paletteRows,
        null,
        { kind, xId: 'Pos', yId: 'PTS' }
      );
      expect(chart).not.toBeNull();
      expect(chart?.kind).toBe(kind);
    }
  );

  it('keeps a bar of two numeric columns a bar', () => {
    const chart = buildChartFromDataset('bar chart of PTS by Age', paletteColumns, paletteRows);
    expect(chart?.kind).toBe('bar');
    expect(chart && 'categories' in chart ? chart.categories.length : 0).toBeGreaterThan(0);
  });

  it('does not offer Heatmap until a heatmap chart exists', () => {
    expect(PALETTE_MENU_TO_KIND).not.toHaveProperty('Heatmap');
    expect(Object.values(PALETTE_MENU_TO_KIND)).toEqual([
      'bar',
      'line',
      'scatter',
      'histogram',
      'boxplot',
      'pie',
      'area',
      'violin',
      'density',
    ]);
  });

  it('loads every preview page and then applies the sheet filter', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          variable_names: ['Pos', 'PTS'],
          headers: ['Pos', 'PTS'],
          rows: [
            ['G', 10],
            ['F', 20],
          ],
          truncated: true,
          offset: 0,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          variable_names: ['Pos', 'PTS'],
          headers: ['Pos', 'PTS'],
          rows: [['C', 30]],
          truncated: false,
          offset: 2,
        }),
      });
    const previous = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const rows = await loadFilteredChartRows('dataset-1', [
        { id: 'Pos', value: { operator: 'equals', value: 'G' } },
      ]);
      expect(rows).toEqual([{ Pos: 'G', PTS: 10 }]);
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain('offset=2');
    } finally {
      global.fetch = previous;
    }
  });

  it('keeps the first preview page when the server ignores offset', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          variable_names: ['Pos', 'PTS'],
          headers: ['Pos', 'PTS'],
          rows: [['G', 10]],
          truncated: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          variable_names: ['Pos', 'PTS'],
          headers: ['Pos', 'PTS'],
          rows: [
            ['G', 10],
            ['F', 99],
          ],
          truncated: true,
        }),
      });
    const previous = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const rows = await loadFilteredChartRows('dataset-1');
      expect(rows).toEqual([{ Pos: 'G', PTS: 10 }]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      global.fetch = previous;
    }
  });
});
