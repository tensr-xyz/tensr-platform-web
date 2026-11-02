import { ApiRequestError } from '@/lib/api-error';
import { runAgentLoop } from '@/lib/run-agent-loop';
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

  it('retries a first 503 once and says the service is warming up', async () => {
    progress.mockReset();
    stream
      .mockRejectedValueOnce(new ApiRequestError(503, 'starting'))
      .mockResolvedValueOnce({ status: 'ok', mode: 'agent' });
    const pending = runAgentLoop({ message: 'table', mode: 'agent', onProgress: progress });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ status: 'ok', mode: 'agent' });
    expect(stream).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'warming', message: 'Warming up' })
    );
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
  });

  it('does not retry a 401', async () => {
    stream.mockRejectedValueOnce(new ApiRequestError(401, 'no'));
    await expect(runAgentLoop({ message: 'table', mode: 'agent' })).rejects.toBeInstanceOf(
      ApiRequestError
    );
    expect(stream).toHaveBeenCalledTimes(1);
  });
});
