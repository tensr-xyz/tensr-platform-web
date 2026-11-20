import {
  chatPromptForWarnings,
  explainWarnings,
  warningsFromOutputChecks,
} from './explain-warnings';

describe('explain warnings client', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('picks warn chips for Explain this and all chips for Explain all', () => {
    const checks = [
      { label: 'Low base on Region', warn: true },
      { label: 'Listwise n=12', warn: false },
    ];
    expect(warningsFromOutputChecks(checks)).toEqual([
      { message: 'Low base on Region', source: 'output' },
    ]);
    expect(warningsFromOutputChecks(checks, { all: true })).toHaveLength(2);
  });

  it('builds a composer seed prompt', () => {
    expect(chatPromptForWarnings([{ message: 'Low base on Region' }])).toContain(
      'Explain this warning'
    );
    expect(chatPromptForWarnings(['A', 'B'], 'all')).toContain('1. A');
  });

  it('posts explain-warnings and returns markdown plus chat_prompt', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        markdown: '**Low base on Region**\n\nSmall bases swing.',
        source: 'template',
        scope: 'one',
        warnings: [{ message: 'Low base on Region' }],
        chat_prompt: 'Explain this warning in plain language: Low base on Region',
        n_warnings: 1,
      }),
    }) as unknown as typeof fetch;

    const result = await explainWarnings(
      { warnings: [{ message: 'Low base on Region' }], datasetId: 'ds-1' },
      'tok'
    );
    expect(result.n_warnings).toBe(1);
    expect(result.chat_prompt).toContain('Low base on Region');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/assistant/explain-warnings'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        body: expect.stringContaining('"dataset_id":"ds-1"'),
      })
    );
  });
});
