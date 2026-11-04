import { fetchColumnStats, resetColumnStatsCacheForTests } from './column-stats-fetch';

jest.mock('@/lib/tensr-api-url', () => ({
  tensrApiUrl: (path: string) => `http://api.test${path}`,
}));

describe('fetchColumnStats', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    resetColumnStatsCacheForTests();
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
    fetchMock.mockResolvedValue({
      ok: true,
      statusText: 'OK',
      json: async () => ({ age: { data_type: 'float64', numeric_stats: { mean: 1 } } }),
    });
  });

  it('fetches analyze-file once for a dataset version', async () => {
    const [left, right] = await Promise.all([
      fetchColumnStats('ds-stats', 'etag-1', 'token'),
      fetchColumnStats('ds-stats', 'etag-1', 'token'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(left).toEqual(right);
    await fetchColumnStats('ds-stats', 'etag-1', 'token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fetchColumnStats('ds-stats', 'etag-2', 'token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reuses stats fetched before the schema version was known', async () => {
    await fetchColumnStats('ds-stats', null, 'token');
    await fetchColumnStats('ds-stats', 'etag-1', 'token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
