import { fetchWithColdStartRetry, subscribeDatasetColdStart } from './cold-start-fetch';

describe('fetchWithColdStartRetry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries a 503 and then returns the successful response', async () => {
    const http = (status: number) => ({ status, ok: status >= 200 && status < 300 }) as Response;
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(http(503) as never)
      .mockResolvedValueOnce(http(200) as never);
    let starting = 0;
    const stop = subscribeDatasetColdStart(() => {
      starting += 1;
    });
    const response = await fetchWithColdStartRetry('/datasets/ds/schema', undefined, {
      attempts: 2,
      delaysMs: [0],
    });
    stop();
    expect(response.ok).toBe(true);
    expect(starting).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
