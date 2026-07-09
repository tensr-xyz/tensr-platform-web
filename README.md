# Tensr Platform Web

Production web client for **Tensr** — upload datasets, run statistical analyses, and use the AI assistant in the browser.

> **Ship target:** This package (`tensr-platform-web`) is the launch vehicle (Option A). Backend: [`tensr-api`](../tensr-api/README.md).

## Requirements

- Node.js 20+
- pnpm (recommended) or npm
- Running [`tensr-api`](../tensr-api/README.md) instance

## Quick start (local)

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN and NEXT_PUBLIC_TENSR_API_URL

pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable                             | Required          | Description                                                        |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN`    | **Yes**           | Stytch public token for auth                                       |
| `NEXT_PUBLIC_TENSR_API_URL`          | **Yes** (prod)    | FastAPI base URL (default `http://127.0.0.1:8000`)                 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | For billing       | Stripe publishable key                                             |
| `NEXT_PUBLIC_WEBSOCKET_URL`          | For collaboration | WebSocket base (e.g. `wss://api.example.com/ws/yjs`)               |
| `NEXT_PUBLIC_DISABLE_USAGE_TRACKING` | No                | Set `true` to disable client telemetry                             |
| `E2E_AUTH_BYPASS`                    | E2E only          | Set `true` in local Playwright runs only — **never in production** |

AI assistant chat requires **`OPENAI_API_KEY`** on **tensr-api** (not this app).

## Authentication

- Stytch email OTP + Google OAuth (`/login`)
- Server-side protection via `src/proxy.ts` (Next.js 16 proxy / Stytch session cookies)
- Protected routes: `/dashboard`, `/workspace`, `/settings`, `/plugins`, `/creator`, `/project`, `/subscription`
- Public routes: `/login` (and `/register` if enabled)
- `/` redirects to `/dashboard`
- Marketing site: [`tensr-landing-ui`](../tensr-landing-ui) on `www.tensr.xyz`
- Visualiser: [`tensr-visualiser-ui`](../tensr-visualiser-ui) on `visualizer.tensr.xyz`

### Stytch production checklist

- Configure allowed redirect URLs for your production domain
- Set cookie domain / SameSite so session cookies work on your apex + app subdomain
- Use production Stytch project token in `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN`

## Supported analyses (v1)

All run against **tensr-api** `/datasets/{id}/analyze/*`:

Descriptive statistics · Correlation · Independent / paired / one-sample t-tests · One-way ANOVA · Mann–Whitney · Kruskal–Wallis · Linear regression · Logistic regression · Chi-square

Charts: ask the **AI assistant** in the workspace (Charts tab is disabled; agent renders inline charts).

## Build & deploy

```bash
pnpm build   # next build (standalone output)
pnpm start   # node .next/standalone/server.js after copying static assets
```

`next.config.ts` sets `output: 'standalone'` for container deployment.

### CORS

Ensure **tensr-api** allows your web origin for browser `fetch` and WebSocket connections.

### Docker (typical)

1. Build image with env vars injected at runtime (not baked into the image)
2. Serve on port 3000 behind HTTPS terminator
3. Point `NEXT_PUBLIC_TENSR_API_URL` at the public API URL (not localhost)

## Testing

```bash
# Unit tests (Jest)
pnpm exec jest src/lib --passWithNoTests

# E2E (Playwright) — starts dev server with E2E_AUTH_BYPASS=true
pnpm test
```

## Billing / subscription (staging)

Before launch, validate on **Stripe test mode**:

1. New user → paywalled feature → `/subscription`
2. Checkout with card `4242 4242 4242 4242`
3. `/settings/billing` shows plan + invoices
4. Webhooks: `invoice.paid`, `customer.subscription.updated`

## Collaboration

When enabled, set `NEXT_PUBLIC_WEBSOCKET_URL`. The client passes the Stytch JWT as a `token` query param on the y-websocket connection; the WS server must validate it.

## Launch checklist

See [LAUNCH_READINESS.md](./LAUNCH_READINESS.md) for the full pre-launch sign-off list.
