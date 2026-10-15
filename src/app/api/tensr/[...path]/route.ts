import { NextRequest, NextResponse } from 'next/server';
import { getPostHogClient } from '@/lib/posthog-server';
import { getTensrApiBaseUrl } from '@/lib/tensr-api-url';
import {
  buildAssistantStreamTargetUrl,
  buildTensrProxyTargetUrl,
} from '@/lib/tensr-proxy-target-url';
import { ACTIVE_ORGANISATION_COOKIE, resolveProxyOrganisationId } from '@/lib/active-organisation';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function buildTarget(
  pathSegments: string[],
  search: string
): { url: string; upstream: 'function-url' | 'api-gateway' } {
  const streamUrl = buildAssistantStreamTargetUrl(pathSegments, search);
  if (streamUrl) return { url: streamUrl, upstream: 'function-url' };
  return {
    url: buildTensrProxyTargetUrl(pathSegments, search, getTensrApiBaseUrl()),
    upstream: 'api-gateway',
  };
}

function isStreamingProxyPath(pathSegments: string[]): boolean {
  const joined = pathSegments.join('/').toLowerCase();
  if (joined.includes('/analyze/') && joined.endsWith('/stream')) return true;
  return (
    joined.endsWith('assistant/agent-loop/stream') ||
    joined.endsWith('assistant/agent-loop-v2/stream') ||
    joined.endsWith('agent-loop/stream') ||
    joined.endsWith('agent-loop-v2/stream')
  );
}

/** Text and JSON stay decoded. Everything else, including xlsx, pptx, and pdf, is streamed as bytes. */
export function shouldDecodeBodyAsText(contentType: string): boolean {
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!type) return false;
  if (type.startsWith('text/')) return true;
  if (type === 'application/json' || type.endsWith('+json')) return true;
  return false;
}

function sessionIdFromBody(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { session_id?: unknown };
    return typeof parsed.session_id === 'string' && parsed.session_id ? parsed.session_id : null;
  } catch {
    return null;
  }
}

function captureStreamStatus(input: {
  status: number;
  sessionId: string | null;
  distinctId: string | null;
  path: string;
  upstream: string;
}) {
  if (input.status < 400 || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  try {
    getPostHogClient().captureException(
      new Error(`agent stream upstream ${input.status}`),
      input.distinctId || 'tensr-web',
      {
        status: input.status,
        session_id: input.sessionId,
        distinct_id: input.distinctId,
        path: input.path,
        upstream: input.upstream,
      }
    );
  } catch {
    // Analytics must not change the stream the user is reading.
  }
}

function forwardResponseHeaders(from: Headers): Headers {
  const headers = new Headers();
  from.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

function looksLikeSse(bytes: Uint8Array | undefined): boolean {
  if (!bytes || bytes.length === 0) return false;
  const head = new TextDecoder().decode(bytes.slice(0, 64));
  return /^\s*(:|data:|event:|id:)/.test(head);
}

function continueAfter(
  first: ReadableStreamReadResult<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      if (first.value) controller.enqueue(first.value);
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) {
            controller.close();
            return;
          }
          if (next.value) controller.enqueue(next.value);
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function reportProxyException(error: unknown, pathSegments: string[]): void {
  const path = pathSegments.join('/');
  if (!path.includes('upload') || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  try {
    getPostHogClient().captureException(
      error instanceof Error ? error : new Error(String(error)),
      undefined,
      {
        path,
        file_type: null,
        sheet_count: null,
        row_count: null,
        col_count: null,
        parser_error: error instanceof Error ? error.message : String(error),
      }
    );
  } catch {
    // A failed report must not replace the 502 the browser is waiting on.
  }
}

async function proxyRequest(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const { url: targetUrl, upstream } = buildTarget(pathSegments, req.nextUrl.search);
  const streamPath = isStreamingProxyPath(pathSegments);

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('Authorization', auth);
  const orgId = resolveProxyOrganisationId(
    req.headers.get('x-organization-id'),
    req.cookies.get(ACTIVE_ORGANISATION_COOKIE)?.value
  );
  if (orgId) headers.set('X-Organization-Id', orgId);
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const distinctId = req.headers.get('x-tensr-distinct-id');
  if (streamPath) {
    headers.set('Accept', 'text/event-stream');
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  let requestBody = '';
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const requestType = req.headers.get('content-type') ?? '';
    // req.text() UTF-8-decodes the body and corrupts an xlsx inside multipart.
    if (shouldDecodeBodyAsText(requestType)) {
      requestBody = await req.text();
      init.body = requestBody;
    } else {
      init.body = await req.arrayBuffer();
    }
  }

  try {
    const res = await fetch(targetUrl, init);
    const upstreamType = res.headers.get('Content-Type') ?? '';
    const eventStreamBody = upstreamType.includes('text/event-stream');
    const isEventStream = streamPath || eventStreamBody;
    if (streamPath && res.status >= 400) {
      captureStreamStatus({
        status: res.status,
        sessionId: sessionIdFromBody(requestBody),
        distinctId,
        path: pathSegments.join('/'),
        upstream,
      });
    }

    // Auth-scoped proxy: never let browsers/CDNs reuse a previous user's session
    // or an expired /me payload (see next.config /api Cache-Control).
    const noStore = 'private, no-store, no-cache, must-revalidate';

    // Wait for the first byte on a stream route, then pass the upstream status.
    // An SSE body is the turn, so the browser status is 200 and the real status
    // stays on X-Tensr-Upstream-Status.
    if (streamPath && res.body) {
      const reader = res.body.getReader();
      const first = await reader.read();
      const sse = looksLikeSse(first.value);
      const outHeaders = forwardResponseHeaders(res.headers);
      outHeaders.set('Cache-Control', `${noStore}, no-transform`);
      outHeaders.set('Pragma', 'no-cache');
      outHeaders.set('X-Accel-Buffering', 'no');
      outHeaders.set('X-Tensr-Upstream', upstream);
      if (sse) outHeaders.set('Content-Type', 'text/event-stream');
      const gatewayBusy = res.status === 502 || res.status === 503 || res.status === 504;
      if (gatewayBusy && !sse) {
        outHeaders.set('Content-Type', 'text/event-stream');
        outHeaders.set('X-Tensr-Upstream-Status', String(res.status));
        const sessionId = sessionIdFromBody(requestBody);
        const payload = `data: ${JSON.stringify({
          type: 'result',
          status: 'continuing',
          session_id: sessionId,
          answer_markdown: '',
        })}\n\n`;
        return new NextResponse(payload, { status: 200, headers: outHeaders });
      }
      const status = sse ? 200 : res.status;
      if (status !== res.status) outHeaders.set('X-Tensr-Upstream-Status', String(res.status));
      return new NextResponse(continueAfter(first, reader), { status, headers: outHeaders });
    }

    if (
      streamPath &&
      !res.body &&
      (res.status === 502 || res.status === 503 || res.status === 504)
    ) {
      const outHeaders = forwardResponseHeaders(res.headers);
      outHeaders.set('Cache-Control', `${noStore}, no-transform`);
      outHeaders.set('Content-Type', 'text/event-stream');
      outHeaders.set('X-Tensr-Upstream', upstream);
      outHeaders.set('X-Tensr-Upstream-Status', String(res.status));
      const payload = `data: ${JSON.stringify({
        type: 'result',
        status: 'continuing',
        session_id: sessionIdFromBody(requestBody),
        answer_markdown: '',
      })}\n\n`;
      return new NextResponse(payload, { status: 200, headers: outHeaders });
    }

    // SSE must pass through without buffering or the client sees one blob at the end.
    if (isEventStream && res.body) {
      const outHeaders = forwardResponseHeaders(res.headers);
      outHeaders.set('Cache-Control', `${noStore}, no-transform`);
      outHeaders.set('Pragma', 'no-cache');
      outHeaders.set('X-Accel-Buffering', 'no');
      // API Gateway caps a turn at 30s; only the Function URL streams past it.
      outHeaders.set('X-Tensr-Upstream', upstream);
      // A 5xx on a real event-stream is the status arriving late. The body is the turn.
      const status = eventStreamBody && res.status >= 400 ? 200 : res.status;
      if (status !== res.status) {
        outHeaders.set('X-Tensr-Upstream-Status', String(res.status));
      }
      return new NextResponse(res.body, {
        status,
        headers: outHeaders,
      });
    }

    // res.text() UTF-8-decodes the body and inserts EF BF BD into xlsx, pptx, and pdf.
    if (!shouldDecodeBodyAsText(upstreamType) && res.body) {
      const outHeaders = forwardResponseHeaders(res.headers);
      outHeaders.set('Cache-Control', noStore);
      outHeaders.set('Pragma', 'no-cache');
      if (!outHeaders.has('Content-Type')) {
        outHeaders.set('Content-Type', upstreamType || 'application/octet-stream');
      }
      return new NextResponse(res.body, {
        status: res.status,
        headers: outHeaders,
      });
    }

    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': upstreamType || 'application/json',
        'Cache-Control': noStore,
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream request failed';
    if (streamPath) {
      captureStreamStatus({
        status: 502,
        sessionId: sessionIdFromBody(requestBody),
        distinctId,
        path: pathSegments.join('/'),
        upstream,
      });
    }
    reportProxyException(error, pathSegments);
    return NextResponse.json(
      {
        detail: `Could not reach tensr-api at ${targetUrl}: ${message}`,
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  }
}

export const dynamic = 'force-dynamic';
/** Stay above the 29s API Gateway cap so Vercel does not 500 first. */
export const maxDuration = 60;

type RouteContext = { params: Promise<{ path: string[] }> };

async function withPath(
  req: NextRequest,
  ctx: RouteContext,
  handler: (req: NextRequest, path: string[]) => Promise<NextResponse>
) {
  const { path } = await ctx.params;
  return handler(req, path);
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  return withPath(req, ctx, proxyRequest);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return withPath(req, ctx, proxyRequest);
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  return withPath(req, ctx, proxyRequest);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return withPath(req, ctx, proxyRequest);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return withPath(req, ctx, proxyRequest);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
