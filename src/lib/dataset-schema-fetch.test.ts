class TestResponse {
  status: number;
  ok: boolean;
  headers: { entries: () => [string, string][] };
  private bodyText: string;

  constructor(body: string, init?: { status?: number; headers?: [string, string][] }) {
    this.bodyText = body;
    this.status = init?.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    const pairs = init?.headers ?? [];
    this.headers = { entries: () => pairs };
  }

  text(): Promise<string> {
    return Promise.resolve(this.bodyText);
  }

  json(): Promise<unknown> {
    return Promise.resolve(JSON.parse(this.bodyText));
  }
}

(global as { Response?: typeof TestResponse }).Response = TestResponse;

import { fetchDatasetSchema } from './dataset-schema-fetch';

jest.mock('@/lib/cold-start-fetch', () => ({
  fetchWithColdStartRetry: jest.fn(),
}));

jest.mock('@/lib/tensr-api-url', () => ({
  tensrApiUrl: (path: string) => `http://api.test${path}`,
}));

import { fetchWithColdStartRetry } from '@/lib/cold-start-fetch';

const fetchSchema = fetchWithColdStartRetry as jest.Mock;

describe('fetchDatasetSchema', () => {
  beforeEach(() => {
    fetchSchema.mockReset();
    fetchSchema.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ schema: [{ name: 'Q1' }] }),
      headers: { entries: () => [] as [string, string][] },
    });
  });

  it('reuses one schema response for the callers on a page load', async () => {
    const first = fetchDatasetSchema('ds-1', { headers: { Authorization: 'Bearer a' } });
    const second = fetchDatasetSchema('ds-1', { headers: { Authorization: 'Bearer a' } });
    const [left, right] = await Promise.all([first, second]);
    expect(fetchSchema).toHaveBeenCalledTimes(1);
    expect(await left.json()).toEqual({ schema: [{ name: 'Q1' }] });
    expect(await right.json()).toEqual({ schema: [{ name: 'Q1' }] });
    await fetchDatasetSchema('ds-1');
    expect(fetchSchema).toHaveBeenCalledTimes(1);
  });
});
