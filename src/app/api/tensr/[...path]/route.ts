import { NextRequest, NextResponse } from 'next/server';
import { getTensrApiBaseUrl, isRemoteTensrApi } from '@/lib/tensr-api-url';

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

function buildTargetUrl(pathSegments: string[], search: string): string {
  const base = getTensrApiBaseUrl().replace(/\/$/, '');
  const joined = pathSegments.join('/');
  let target = isRemoteTensrApi(base) ? `${base}/api/${joined}` : `${base}/${joined}`;
  // FastAPI list routes are registered as `/datasets/` (trailing slash).
  if (/^datasets$/i.test(joined)) {
    target = `${target}/`;
  }
  return search ? `${target}${search}` : target;
}

function isStreamingProxyPath(pathSegments: string[]): boolean {
  const joined = pathSegments.join('/').toLowerCase();
  return (
    joined.includes('followup/stream') ||
    (joined.includes('/analyze/') && joined.endsWith('/stream'))
  );
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

async function proxyRequest(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const targetUrl = buildTargetUrl(pathSegments, req.nextUrl.search);
  const streamPath = isStreamingProxyPath(pathSegments);

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('Authorization', auth);
  const orgId = req.headers.get('x-organization-id');
  if (orgId) headers.set('X-Organization-Id', orgId);
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  if (streamPath) {
    headers.set('Accept', 'text/event-stream');
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const res = await fetch(targetUrl, init);
    const upstreamType = res.headers.get('Content-Type') ?? '';
    const isEventStream = streamPath || upstreamType.includes('text/event-stream');

    // SSE must pass through without buffering or the client sees one blob at the end.
    if (isEventStream && res.body) {
      const outHeaders = forwardResponseHeaders(res.headers);
      if (!outHeaders.has('Cache-Control')) {
        outHeaders.set('Cache-Control', 'no-cache, no-transform');
      }
      outHeaders.set('X-Accel-Buffering', 'no');
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
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream request failed';
    return NextResponse.json(
      {
        detail: `Could not reach tensr-api at ${targetUrl}: ${message}`,
      },
      { status: 502 }
    );
  }
}

export const dynamic = 'force-dynamic';

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
