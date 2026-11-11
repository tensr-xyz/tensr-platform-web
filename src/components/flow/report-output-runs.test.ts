import {
  baseCount,
  dayLabel,
  metricLines,
  outputRuns,
  statusCounts,
  summaryText,
} from './report-output-runs';

describe('report outputs', () => {
  it('keeps saved runs and counts the statuses the list actually returned', () => {
    const runs = outputRuns([
      {
        id: 'a',
        op: 'anova_oneway',
        title: 'score by region',
        created_at: '2026-11-02T14:02:00Z',
        status: 'complete',
      },
      { id: '', op: 'crosstab', title: 'dropped' },
      { id: 'b', op: 'crosstab', title: '', created_at: '2026-11-01T10:00:00Z' },
    ]);
    expect(runs.map(run => run.title)).toEqual(['score by region', 'crosstab']);
    expect(statusCounts(runs)).toEqual([{ status: 'complete', count: 2 }]);
    expect(dayLabel('2026-11-02T14:02:00Z', new Date('2026-11-02T18:00:00Z'))).toBe('Today');
    expect(dayLabel('2026-11-01T10:00:00Z', new Date('2026-11-02T18:00:00Z'))).toBe('Yesterday');
  });

  it('reads the base and summary from the saved run', () => {
    const run = {
      report: { summary: 'Score differs by region.', meta: { rows_dataset: 403 } },
    };
    expect(summaryText(run)).toBe('Score differs by region.');
    expect(
      summaryText({
        report: {
          summary: '54 rows were excluded.',
          answer_from_result: true,
          answer: 'Chi-square. Pearson chi-square = 9.100, df = 1.000, p = 0.003.',
        },
      })
    ).toContain('Pearson chi-square');
    expect(baseCount(run)).toBe(403);
    expect(baseCount({ report: { meta: { rows_dataset: 30 } }, result: { n_used: 22 } })).toBe(22);
    expect(baseCount({ result: { n_used: 3 } })).toBe(3);
    expect(baseCount({ result: { n_answered: 500, n_rows: 800 } })).toBe(500);
    expect(baseCount({})).toBeNull();
    expect(
      metricLines({
        report: {
          metrics: [
            { label: 'Responses coded', value: '500' },
            { label: 'Krippendorff α', value: '—' },
          ],
        },
      })
    ).toEqual([{ label: 'Responses coded', value: '500' }]);
    expect(metricLines({ report: { metrics: [{ label: 'Weight', value: 'none' }] } })).toEqual([
      { label: 'Weight', value: 'Unweighted' },
    ]);
  });
});

describe('output titles and states', () => {
  it('moves weighting and base out of the title', () => {
    const { splitRunTitle } = jest.requireActual('./report-output-runs');
    expect(splitRunTitle('aware_A × region_market — Unweighted, n = 30')).toEqual({
      title: 'aware_A × region_market',
      weighting: 'Unweighted',
      base: 30,
    });
    expect(splitRunTitle('likes_A by region')).toEqual({
      title: 'likes_A by region',
      weighting: '',
      base: null,
    });
  });

  it('labels a new variable and does not show the tool name', () => {
    const { outputKindLabel } = jest.requireActual('./report-output-runs');
    expect(outputKindLabel('compute')).toBe('New variable');
    expect(outputKindLabel('descriptives')).toBe('Descriptive statistics');
    expect(outputKindLabel('code_open_text')).toBe('Open-text coding');
    expect(outputKindLabel('nps')).toBe('NPS');
    expect(outputKindLabel('funnel')).toBe('Funnel');
    expect(outputKindLabel('not_a_tool')).toBe('Analysis');
  });

  it('reads In report, Saved, or Draft from real state', () => {
    const { runState } = jest.requireActual('./report-output-runs');
    expect(runState('complete', true)).toBe('In report');
    expect(runState('complete', false)).toBe('Saved');
    expect(runState('failed', false)).toBe('Draft');
  });
});

describe('run record fields', () => {
  it('reads base and In report from the run record, not the title', () => {
    const { outputRuns } = jest.requireActual('./report-output-runs');
    const [run] = outputRuns([
      {
        id: 'r1',
        op: 'banner_table',
        title: 'aware_A × region — Unweighted, n = 999',
        base_n: 30,
        weighted_base: 28.4,
        in_report: true,
        dataset_id: 'd1',
      },
    ]);
    expect(run.base).toBe(30);
    expect(run.weightedBase).toBe(28.4);
    expect(run.inReport).toBe(true);
    expect(run.title).toBe('aware_A × region');
    const [bare] = outputRuns([{ id: 'r2', op: 'descriptives', title: 'x — n = 12' }]);
    expect(bare.base).toBeNull();
  });
});
