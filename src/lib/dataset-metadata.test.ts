import { fetchDatasetColumnMetadata, resetDatasetMetadataCacheForTests } from './dataset-metadata';

jest.mock('@/lib/tensr-api-url', () => ({
  tensrApiUrl: (path: string) => `http://api.test${path}`,
}));

describe('fetchDatasetColumnMetadata', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    resetDatasetMetadataCacheForTests();
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ column_metadata: { gender: { type: 'numeric' } } }),
      text: async () => '',
    });
  });

  it('reuses one metadata response per dataset', async () => {
    const [left, right] = await Promise.all([
      fetchDatasetColumnMetadata('ds-meta'),
      fetchDatasetColumnMetadata('ds-meta'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(left).toEqual(right);
    await fetchDatasetColumnMetadata('ds-meta');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
