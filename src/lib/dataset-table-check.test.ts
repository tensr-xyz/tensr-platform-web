import { checkDatasetTables } from './dataset-data-ops';

describe('checkDatasetTables', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts the tables payload to /table-check and returns the report', async () => {
    const report = {
      n_tables: 1,
      ok: true,
      summary: { matched: 2, differs: 0, cant_tell: 0, rounding: 0 },
      cause_labels: { matched: 'Matched' },
      tables: [
        {
          title: 'Region by Brand',
          ok: true,
          summary: { matched: 2, differs: 0, cant_tell: 0, rounding: 0 },
          cells: [
            {
              stub_label: 'North',
              banner_label: 'A',
              uploaded: { percent: 50 },
              expected: { percent: 50 },
              status: 'matched',
              cause: 'matched',
              cause_label: 'Matched',
            },
          ],
        },
      ],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => report,
    }) as unknown as typeof fetch;

    const result = await checkDatasetTables('ds-1', {
      tables: [
        {
          title: 'Region by Brand',
          cells: [{ stub_label: 'North', banner_label: 'A', percent: 50 }],
        },
      ],
      stub_column: 'region',
      banner_column: 'brand',
    });

    expect(result.ok).toBe(true);
    expect(result.tables[0]?.cells[0]?.cause_label).toBe('Matched');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/datasets/ds-1/table-check'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"stub_column":"region"'),
      })
    );
  });
});
