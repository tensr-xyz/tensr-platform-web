import { baseCount, dayLabel, outputRuns, statusCounts, summaryText } from './report-output-runs';

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
    expect(baseCount(run)).toBe(403);
    expect(baseCount({ result: { n_used: 3 } })).toBe(3);
    expect(baseCount({})).toBeNull();
  });
});
