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

/** WebSocket base for tensr-api realtime (JSON hub or Yjs path suffix). */
export function getTensrWebSocketUrl(path: string = '/ws'): string {
  const httpBase = getTensrApiBaseUrl().replace(/\/$/, '');
  const wsBase = httpBase.replace(/^http/, 'ws');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${wsBase}${suffix}`;
}
