import {
  buildChartFromDataset,
  isChartIntent,
  shouldRouteToInlineChart,
} from './agent-chart-from-dataset';

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
});
