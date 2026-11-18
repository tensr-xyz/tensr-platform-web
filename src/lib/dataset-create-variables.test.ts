import { createDatasetVariables } from './dataset-data-ops';

describe('createDatasetVariables client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts create-variables with operation and scope', async () => {
    const payload = {
      dataset_id: 'ds-2',
      original_filename: 'scaled.parquet',
      created_columns: ['a_case_center', 'b_case_center'],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }) as unknown as typeof fetch;

    const result = await createDatasetVariables(
      'ds-1',
      { columns: ['a', 'b'], operation: 'center', scope: 'case' },
      'tok'
    );
    expect(result.created_columns).toEqual(['a_case_center', 'b_case_center']);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/datasets/ds-1/create-variables'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        body: expect.stringContaining('"operation":"center"'),
      })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ columns: ['a', 'b'], operation: 'center', scope: 'case' });
  });

  it('posts log transform without inventing a scope', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ dataset_id: 'ds-3', created_columns: ['spend_log'] }),
    }) as unknown as typeof fetch;

    await createDatasetVariables('ds-1', { columns: ['spend'], operation: 'log' }, null);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ columns: ['spend'], operation: 'log' });
  });
});
