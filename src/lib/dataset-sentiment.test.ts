import { applyOpenEndSentiment } from './dataset-data-ops';

describe('applyOpenEndSentiment client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts open-end sentiment with confirm and model flags', async () => {
    const payload = {
      done: true,
      sentiment_column: 'comment_sentiment',
      derived_dataset_id: 'ds-2',
      shares: [{ id: 'positive', label: 'Positive', n: 2, percent: 100 }],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    }) as unknown as typeof fetch;

    const result = await applyOpenEndSentiment(
      'ds-1',
      {
        text_column: 'comment',
        use_model: true,
        confirm_verbatims_sent: true,
      },
      'tok'
    );
    expect(result.sentiment_column).toBe('comment_sentiment');
    expect(result.shares?.[0]?.label).toBe('Positive');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/datasets/ds-1/open-end/sentiment'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({
      text_column: 'comment',
      use_model: true,
      confirm_verbatims_sent: true,
    });
  });

  it('posts review overrides without inventing model flags', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ done: true, sentiment_column: 'comment_sentiment' }),
    }) as unknown as typeof fetch;

    await applyOpenEndSentiment(
      'ds-1',
      { text_column: 'comment', overrides: { '0': 'negative', '1': 'Positive' } },
      null
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({
      text_column: 'comment',
      overrides: { '0': 'negative', '1': 'Positive' },
    });
  });
});
