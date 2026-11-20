import { outputCardReady, outputRunIds } from '@/components/flow/chat-output';
import { staleCardKey, uniqueStale } from '@/components/flow/project-tables';

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

  it('keeps the output column closed after a failed coding run with tool_results', () => {
    // openChat used to open the panel on tool_results.length; failed coding still has results.
    const failedCoding = {
      status: 'ok',
      tool_results: [
        {
          ok: false,
          name: 'run_operations',
          procedure: 'code_open_ends',
          error: 'Coding could not finish.',
          result: { ok: false, error: 'Coding could not finish.' },
        },
      ],
    };
    expect(failedCoding.tool_results.length).toBeGreaterThan(0);
    expect(outputCardReady(failedCoding, false)).toBe(false);
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

  it('keys a stale card by spec id and T number, and keeps one of each', () => {
    const rows = [
      { id: '6cd03cde', number: 13, label: 'first' },
      { id: '6cd03cde', number: 13, label: 'copy' },
      { id: '6cd03cde', number: 14, label: 'other' },
    ];
    expect(uniqueStale(rows).map(row => row.label)).toEqual(['first', 'other']);
    expect(new Set(uniqueStale(rows).map(staleCardKey)).size).toBe(2);
  });
});
