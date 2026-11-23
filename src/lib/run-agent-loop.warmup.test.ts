import { ApiRequestError } from '@/lib/api-error';
import {
  AGENT_LOOP_RETRYING_MESSAGE,
  AGENT_LOOP_UNREACHABLE_MESSAGE,
  runAgentLoop,
} from '@/lib/run-agent-loop';
import { streamAgentLoop } from '@/lib/stream-agent-loop';

jest.mock('@/lib/stream-agent-loop', () => ({
  streamAgentLoop: jest.fn(),
}));

const stream = streamAgentLoop as jest.Mock;

describe('runAgentLoop cold start', () => {
  beforeEach(() => {
    stream.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const progress = jest.fn();

  it('retries a 503 with backoff and a restarting status line', async () => {
    progress.mockReset();
    stream
      .mockRejectedValueOnce(new ApiRequestError(503, 'starting'))
      .mockRejectedValueOnce(new ApiRequestError(503, 'starting'))
      .mockResolvedValueOnce({ status: 'ok', mode: 'agent', answer_markdown: 'Done.' });
    const pending = runAgentLoop({ message: 'table', mode: 'agent', onProgress: progress });
    await jest.advanceTimersByTimeAsync(800);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1600);
    await expect(pending).resolves.toEqual({
      status: 'ok',
      mode: 'agent',
      answer_markdown: 'Done.',
    });
    expect(stream).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenCalledWith({
      type: 'progress',
      step: 'retry',
      message: AGENT_LOOP_RETRYING_MESSAGE,
    });
  });

  it('reuses a session id learned mid-stream on the next attempt', async () => {
    stream
      .mockImplementationOnce(async (_params, handlers) => {
        handlers?.onSession?.('sess-kept');
        throw new ApiRequestError(503, 'starting');
      })
      .mockResolvedValueOnce({ status: 'ok', mode: 'agent', session_id: 'sess-kept' });
    const onSession = jest.fn();
    const pending = runAgentLoop({
      message: 'table',
      mode: 'agent',
      onSession,
    });
    await jest.advanceTimersByTimeAsync(800);
    await expect(pending).resolves.toMatchObject({ session_id: 'sess-kept' });
    expect(onSession).toHaveBeenCalledWith('sess-kept');
    expect(stream.mock.calls[1][0].sessionId).toBe('sess-kept');
  });

  it('retries once when the stream ends without a result', async () => {
    progress.mockReset();
    stream
      .mockRejectedValueOnce(
        Object.assign(new Error('The reply did not finish. Ask again.'), {
          name: 'AgentStreamClosed',
        })
      )
      .mockResolvedValueOnce({ status: 'ok', mode: 'agent' });
    const pending = runAgentLoop({ message: 'table', mode: 'agent', onProgress: progress });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ status: 'ok', mode: 'agent' });
    expect(stream).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith({
      type: 'progress',
      step: 'retry',
      message: AGENT_LOOP_RETRYING_MESSAGE,
    });
  });

  it('gives up with a plain unreachable message after repeated 503s', async () => {
    stream.mockRejectedValue(new ApiRequestError(503, 'starting'));
    const pending = runAgentLoop({ message: 'table', mode: 'agent', onProgress: progress });
    const expectation = expect(pending).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining(AGENT_LOOP_UNREACHABLE_MESSAGE),
    });
    for (let i = 0; i < 4; i += 1) {
      await jest.advanceTimersByTimeAsync(4000);
      await Promise.resolve();
    }
    await expectation;
    expect(stream).toHaveBeenCalledTimes(5);
  });

  it('does not retry a 401', async () => {
    stream.mockRejectedValueOnce(new ApiRequestError(401, 'no'));
    await expect(runAgentLoop({ message: 'table', mode: 'agent' })).rejects.toBeInstanceOf(
      ApiRequestError
    );
    expect(stream).toHaveBeenCalledTimes(1);
  });
});
