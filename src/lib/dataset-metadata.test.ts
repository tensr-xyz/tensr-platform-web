import { fetchLoopMetadata } from '@/lib/custom-tables/api';
import {
  fetchDatasetColumnMetadata,
  patchColumnMetadata,
  resetDatasetMetadataCacheForTests,
} from './dataset-metadata';

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

  it('shares that response with loop metadata', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        column_metadata: { gender: { type: 'numeric' } },
        loops: [],
        active_weight_column: 'weight',
      }),
      text: async () => '',
    });
    const [columns, loops] = await Promise.all([
      fetchDatasetColumnMetadata('ds-shared'),
      fetchLoopMetadata('ds-shared'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(columns.gender).toEqual({ type: 'numeric' });
    expect(loops.active_weight_column).toBe('weight');
  });

  it('keeps a patch that lands while a get is in flight', async () => {
    let finishGet: (value: unknown) => void = () => undefined;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            column_metadata: { gender: { type: 'numeric', measure: 'nominal' } },
          }),
          text: async () => '',
        });
      }
      return new Promise(resolve => {
        finishGet = resolve;
      });
    });
    const pending = fetchDatasetColumnMetadata('ds-race');
    await patchColumnMetadata('ds-race', 'gender', { measure: 'nominal' });
    finishGet({
      ok: true,
      json: async () => ({ column_metadata: { gender: { type: 'numeric' } } }),
      text: async () => '',
    });
    await expect(pending).resolves.toEqual({
      gender: { type: 'numeric', measure: 'nominal' },
    });
    await expect(fetchDatasetColumnMetadata('ds-race')).resolves.toEqual({
      gender: { type: 'numeric', measure: 'nominal' },
    });
  });
});
