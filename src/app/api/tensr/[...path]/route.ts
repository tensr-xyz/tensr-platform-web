import { NextRequest, NextResponse } from 'next/server';
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
  return joined.endsWith('assistant/agent-loop/stream') || joined.endsWith('agent-loop/stream');
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
  if (streamPath) {
    headers.set('Accept', 'text/event-stream');
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const res = await fetch(targetUrl, init);
    const upstreamType = res.headers.get('Content-Type') ?? '';
    const isEventStream = streamPath || upstreamType.includes('text/event-stream');

    // Auth-scoped proxy: never let browsers/CDNs reuse a previous user's session
    // or an expired /me payload (see next.config /api Cache-Control).
    const noStore = 'private, no-store, no-cache, must-revalidate';

    // SSE must pass through without buffering or the client sees one blob at the end.
    if (isEventStream && res.body) {
      const outHeaders = forwardResponseHeaders(res.headers);
      outHeaders.set('Cache-Control', `${noStore}, no-transform`);
      outHeaders.set('Pragma', 'no-cache');
      outHeaders.set('X-Accel-Buffering', 'no');
      // API Gateway caps a turn at 30s; only the Function URL streams past it.
      outHeaders.set('X-Tensr-Upstream', upstream);
      return new NextResponse(res.body, {
        status: res.status,
        headers: outHeaders,
      });
    }

    // Binary responses (plugin zips, etc.) must not go through res.text() —
    // UTF-8 decoding corrupts the archive (JSZip: "missing N bytes").
    const joined = pathSegments.join('/').toLowerCase();
    const looksBinary =
      /application\/(zip|octet-stream|x-zip)/i.test(upstreamType) ||
      /\/download$/i.test(joined) ||
      /\.(zip|parquet|bin)$/i.test(joined);
    if (looksBinary && res.body) {
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
