/**
 * Base URL for the **FastAPI tensr-api** (datasets, plugins, settings, billing, orgs).
 *
 * Point `NEXT_PUBLIC_TENSR_API_URL` (or `NEXT_PUBLIC_API_BASE_URL`) at this service
 * (default local: `http://127.0.0.1:8000`). All API routes (datasets, stats, execute, …)
 * use this single base URL.
 *
 * Order: TENSR_API_URL → API_URL → API_BASE_URL → deprecated FARGATE alias → local default.
 */
function resolveTensrApiBaseUrl(): string | undefined {
  const raw =
    process.env.NEXT_PUBLIC_TENSR_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_FARGATE_API_URL;
  return raw?.replace(/\/$/, '') || undefined;
}

/** True when production build is missing a public API URL or still points at localhost. */
export function isTensrApiMisconfigured(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }
  const url = resolveTensrApiBaseUrl();
  if (!url) return true;
  return /localhost|127\.0\.0\.1/i.test(url);
}

export function getTensrApiBaseUrl(): string {
  return resolveTensrApiBaseUrl() ?? 'http://127.0.0.1:8000';
}

/** True when the UI talks to split Lambda stacks behind API Gateway (not local uvicorn monolith). */
export function isRemoteTensrApi(baseUrl: string = getTensrApiBaseUrl()): boolean {
  return /execute-api\.[^.]+\.amazonaws\.com/i.test(baseUrl);
}

/**
 * Build a full tensr-api URL for a path.
 *
 * Local monolith (uvicorn): `/datasets`, `/plugins`, `/assistant` — no extra prefix.
 * Lambda + API Gateway: same paths live under `/api/...` (e.g. `/api/datasets/upload`).
 * Business routes always use `/api` (e.g. `/api/billing/subscription`).
 */
export function tensrApiUrl(path: string, baseUrl: string = getTensrApiBaseUrl()): string {
  const base = baseUrl.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;

  // Browser → remote API Gateway: same-origin Next.js proxy avoids CORS preflight failures.
  if (typeof window !== 'undefined' && isRemoteTensrApi(base)) {
    if (p.startsWith('/api/')) {
      return `/api/tensr/${p.slice(5)}`;
    }
    return `/api/tensr${p}`;
  }

  if (p.startsWith('/api/') || p === '/api') {
    return `${base}${p}`;
  }

  // API Gateway Lambdas mount every route under /api (plugins, usage, datasets, …).
  if (isRemoteTensrApi(base)) {
    return `${base}/api${p}`;
  }

  // Local uvicorn monolith: billing + org routes use /api; domain routes stay at root.
  if (p.startsWith('/billing')) {
    return `${base}/api${p}`;
  }

  return `${base}${p}`;
}

/**
 * WebSocket base URL for tensr-api realtime.
 *
 * PRODUCTION PATH: `RealtimeStack` (`tensr-api/infra/stacks/realtime_stack.py`) is an
 * API Gateway **WebSocket** API with exactly one default integration route, backed by
 * `app.lambda_handlers.realtime_message.handler` → `app/realtime/hub.py` (the JSON hub).
 * Presence, session join/leave, and sheet ops (`subscribe` / `op`) all flow over
 * that single connection. Connection/session/sheet state live in the
 * `REALTIME_CONNECTIONS_TABLE` / `REALTIME_SHEET_LIVE_STATE_TABLE` DynamoDB tables.
 * `NEXT_PUBLIC_WEBSOCKET_URL` should be set to the stack's `RealtimeWebSocketUrl`
 * output (`wss://{api-id}.execute-api.{region}.amazonaws.com/{stage}`).
 *
 * API Gateway WebSocket APIs do not support extra path segments beyond the stage —
 * there is no server-side routing on `/ws`, `/realtime`, or `/ws/yjs/*` in production,
 * so any `path` argument is ignored once `NEXT_PUBLIC_WEBSOCKET_URL` is configured.
 * There is no Yjs/CRDT relay in production (`app/yjs_ws.py` only runs under local
 * uvicorn) and no Fargate service backs it — clients must speak the JSON hub protocol.
 *
 * Since a `path` argument is meaningless once deployed, `hooks/ui/use-session`'s
 * `wsService` opens exactly one physical socket per client and both collaboration
 * session traffic *and* `hooks/ui/use-sheet-state` live-sheet traffic share it —
 * they used to open two independent connections to this same endpoint, which is
 * why cell edits and collaboration-session presence used to live on unreconciled
 * connections. The old ephemeral `cell_update` broadcast (no persistence) is
 * deprecated in favor of the persisted `op` / `sheet_live` path.
 *
 * Local dev only: falls back to the uvicorn base URL with `path` appended, since
 * `app/routers/realtime.py` exposes real path-based routes (`/ws`, `/realtime`) and
 * `app/yjs_ws.py` exposes `/ws/yjs/{room}` for local Yjs experiments.
 */
export function getTensrWebSocketUrl(path: string = '/ws'): string {
  const configured = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.replace(/\/$/, '');
  if (configured) {
    return configured;
  }
  const httpBase = getTensrApiBaseUrl().replace(/\/$/, '');
  const wsBase = httpBase.replace(/^http/, 'ws');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${wsBase}${suffix}`;
}
