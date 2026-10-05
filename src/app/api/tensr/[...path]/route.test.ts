/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';

const FN_URL = 'https://abc123.lambda-url.us-east-1.on.aws/';
const API = 'https://5qv9lg3s55.execute-api.us-east-1.amazonaws.com';

function slowSse(events: string[], gapMs: number): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const e of events) {
        controller.enqueue(enc.encode(`data: ${e}\n\n`));
        await new Promise(r => setTimeout(r, gapMs));
      }
      controller.close();
    },
  });
}

function post(path: string[]) {
  const req = new NextRequest(`http://localhost/api/tensr/${path.join('/')}`, {
    method: 'POST',
    headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'hi' }),
  });
  return POST(req, { params: Promise.resolve({ path }) });
}

describe('/api/tensr proxy: agent-loop stream', () => {
  const env = { ...process.env };
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_TENSR_API_URL = API;
    process.env.TENSR_ASSISTANT_STREAM_URL = FN_URL;
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
      async () =>
        new Response(
          slowSse(['{"type":"tool_start"}', '{"type":"tool_end"}', '{"type":"result"}'], 150),
          {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }
        )
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
    process.env = { ...env };
  });

  it('calls the Function URL and hands each event on before the upstream finishes', async () => {
    const started = Date.now();
    const res = await post(['assistant', 'agent-loop', 'stream']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://abc123.lambda-url.us-east-1.on.aws/api/assistant/agent-loop/stream'
    );
    const sent = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(sent.headers).get('Authorization')).toBe('Bearer t');
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('X-Tensr-Upstream')).toBe('function-url');

    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    const arrivals: number[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (dec.decode(value).includes('data: ')) arrivals.push(Date.now() - started);
    }
    expect(arrivals).toHaveLength(3);
    expect(arrivals[0]).toBeLessThan(100);
    expect(arrivals[2] - arrivals[0]).toBeGreaterThanOrEqual(250);
  });

  it('keeps the JSON agent-loop on API Gateway', async () => {
    fetchMock.mockImplementation(async () => Response.json({ status: 'ok' }));
    await post(['assistant', 'agent-loop']);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/api/assistant/agent-loop`);
  });

  it('uses API Gateway for the stream when no Function URL is set', async () => {
    delete process.env.TENSR_ASSISTANT_STREAM_URL;
    const res = await post(['assistant', 'agent-loop', 'stream']);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/api/assistant/agent-loop/stream`);
    expect(res.headers.get('X-Tensr-Upstream')).toBe('api-gateway');
  });
});
