import { outputCardReady, outputRunIds } from '@/components/flow/chat-output';

describe('round 14', () => {
  it('does not turn a failed procedure into an output card', () => {
    const failed = {
      status: 'ok',
      tool_results: [
        {
          ok: false,
          procedure: 'rake',
          run_id: 'run-that-should-not-card',
          error: 'Choose one: (a) exclude them (weight 0).',
          result: {
            ok: false,
            error: 'Choose one: (a) exclude them (weight 0).',
            run_id: 'run-that-should-not-card',
          },
        },
      ],
    };
    expect(outputRunIds(failed.tool_results)).toEqual([]);
    expect(outputCardReady(failed, false)).toBe(false);
  });

  it('keeps a card when the procedure succeeded', () => {
    const done = {
      status: 'ok',
      tool_results: [
        {
          ok: true,
          procedure: 'rake',
          run_id: 'run-1',
          result: { ok: true },
        },
      ],
    };
    expect(outputRunIds(done.tool_results)).toEqual(['run-1']);
    expect(outputCardReady(done, false)).toBe(true);
    expect(outputCardReady(done, true)).toBe(false);
  });
});
