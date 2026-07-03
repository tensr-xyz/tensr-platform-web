import { toUsageTrackPayload } from './usage-tracker';

describe('toUsageTrackPayload', () => {
  it('coerces float timing and byte counts to integers', () => {
    const payload = toUsageTrackPayload({
      operationType: 'api_call',
      executionTime: 45.789,
      dataProcessed: 1200.4,
      requestSize: 10.2,
      responseSize: 1190.8,
      apiEndpoint: '/sessions',
      httpMethod: 'GET',
      metadata: { statusCode: 200 },
      source: 'api_client',
      timestamp: Date.now(),
    });

    expect(payload.executionTime).toBe(46);
    expect(payload.dataProcessed).toBe(1200);
    expect(payload.metadata).toMatchObject({
      requestSize: 10,
      responseSize: 1191,
      endpoint: '/sessions',
      method: 'GET',
      statusCode: 200,
    });
  });

  it('truncates overlong operation types', () => {
    const payload = toUsageTrackPayload({
      operationType: 'x'.repeat(150),
      timestamp: Date.now(),
    });
    expect(String(payload.operationType)).toHaveLength(120);
  });
});
