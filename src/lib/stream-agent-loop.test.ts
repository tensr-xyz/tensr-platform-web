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
