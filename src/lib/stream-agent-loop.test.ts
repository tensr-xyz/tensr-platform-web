import { TextDecoder, TextEncoder } from 'util';
import { ApiRequestError } from '@/lib/api-error';
import { streamAgentLoop } from '@/lib/stream-agent-loop';

Object.assign(global, { TextDecoder, TextEncoder });

jest.mock('@/utils/auth', () => ({
  getStytchBearerForTensrApi: () => 'test-token',
  getTensrApiHeaders: () => ({}),
}));

function sseFetchResponse(body: string, status = 200) {
  const encoded = new TextEncoder().encode(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['Content-Type', 'text/event-stream']]),
    text: async () => body,
    body: {
      getReader() {
        let done = false;
        return {
          async read() {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: encoded };
          },
          releaseLock() {},
        };
      },
    },
  };
}

describe('streamAgentLoop', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it('surfaces progress then returns the result payload', async () => {
    const onProgress = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValue(
      sseFetchResponse(
        'data: {"type":"progress","step":"context","message":"Reading dataset schema…"}\n\n' +
          'data: {"type":"result","response":{"status":"ok","mode":"agent","answer_markdown":"Done."}}\n\n'
      )
    );

    const result = await streamAgentLoop({ message: 'hello', mode: 'agent' }, { onProgress });

    expect(result.status).toBe('ok');
    expect(result.answer_markdown).toBe('Done.');
    expect(onProgress).toHaveBeenCalledWith({
      type: 'progress',
      step: 'context',
      message: 'Reading dataset schema…',
    });
  });

  it('returns the result even when a progress handler never settles', async () => {
    const onProgress = jest.fn(() => new Promise<void>(() => undefined));
    const burst =
      Array.from(
        { length: 35 },
        (_, i) =>
          `data: {"type":"tool_start","step":"tool","message":"Running step (${i + 1}/35)…"}\n\n`
      ).join('') +
      'data: {"type":"result","response":{"status":"ok","mode":"agent","answer_markdown":"Done."}}\n\n';
    (global.fetch as jest.Mock).mockResolvedValue(sseFetchResponse(burst));

    const result = await streamAgentLoop(
      { message: 'approve', mode: 'plan' },
      { onProgress: onProgress as unknown as (p: unknown) => void }
    );

    expect(result.answer_markdown).toBe('Done.');
    expect(onProgress).toHaveBeenCalledTimes(35);
  });

  it('resolves on the result event without waiting for the stream to close', async () => {
    const encoded = new TextEncoder().encode(
      'data: {"type":"progress","step":"tool","message":"Running merge datasets (3/5)…"}\n\n' +
        'data: {"type":"result","response":{"status":"ok","mode":"plan","answer_markdown":"Merged."}}\n\n'
    );
    const cancel = jest.fn(async () => undefined);
    let reads = 0;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      body: {
        getReader() {
          return {
            read() {
              reads += 1;
              return reads === 1
                ? Promise.resolve({ done: false, value: encoded })
                : new Promise(() => undefined);
            },
            cancel,
            releaseLock() {},
          };
        },
      },
    });

    const result = await streamAgentLoop({ message: 'approve', mode: 'plan' });

    expect(result.answer_markdown).toBe('Merged.');
    expect(reads).toBe(1);
    expect(cancel).toHaveBeenCalled();
  });

  it('maps a timeout event to ApiRequestError 504', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      sseFetchResponse(
        'data: {"type":"timeout","message":"hit the limit","response":{"status":"timeout","mode":"agent","answer_markdown":"hit the limit"}}\n\n' +
          'data: {"type":"result","response":{"status":"timeout","mode":"agent","answer_markdown":"hit the limit"}}\n\n'
      )
    );

    await expect(streamAgentLoop({ message: 'long prep', mode: 'agent' })).rejects.toMatchObject({
      status: 504,
    });
    await expect(streamAgentLoop({ message: 'long prep', mode: 'agent' })).rejects.toBeInstanceOf(
      ApiRequestError
    );
  });
});
