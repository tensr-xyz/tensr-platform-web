import { buildDatasetSummaryTables, fetchDataChecksReport } from './dataset-data-ops';

describe('data checks client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches the data-checks report', async () => {
    const report = {
      respondents: 6,
      n_columns: 4,
      summary: {
        issues: 2,
        construction_issues: 1,
        straightline_questions: 1,
        summary_table_candidates: 3,
      },
      construction: [
        {
          kind: 'unlabeled_code',
          kind_label: 'Value in data with no label',
          column: 'region',
          label: 'Region',
          message: 'Region has 1 value(s) in the data with no label (9).',
          codes: ['9'],
          count: 1,
        },
      ],
      straightlining: [
        {
          kind: 'straightlining',
          kind_label: 'Same answer down a grid',
          label: 'Satisfaction',
          columns: ['sat_1', 'sat_2', 'sat_3'],
          column_labels: ['Price', 'Service', 'Range'],
          straightline_count: 2,
          respondent_pct: 33.3,
          message: 'Satisfaction: 2 respondent(s) gave the same answer on every item (33.3%).',
        },
      ],
      summary_tables: [{ column: 'region', label: 'Region', n_categories: 4 }],
      issue_labels: { unlabeled_code: 'Value in data with no label' },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => report,
    }) as unknown as typeof fetch;

    const result = await fetchDataChecksReport('ds-1', 'tok');
    expect(result.summary.issues).toBe(2);
    expect(result.construction[0]?.kind_label).toBe('Value in data with no label');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/datasets/ds-1/data-checks'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      })
    );
  });

  it('posts summary-tables and returns books', async () => {
    const payload = {
      ok: true,
      n_tables: 1,
      truncated: false,
      limit: 80,
      tables: [
        {
          stub: 'region',
          stub_column: 'region',
          stub_label: 'Region',
          book: { rows: [{ label: 'North' }] },
        },
      ],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }) as unknown as typeof fetch;

    const result = await buildDatasetSummaryTables('ds-1', { columns: ['region'] }, 'tok');
    expect(result.ok).toBe(true);
    expect(result.tables[0]?.stub_label).toBe('Region');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/datasets/ds-1/data-checks/summary-tables'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"columns":["region"]'),
      })
    );
  });
});
