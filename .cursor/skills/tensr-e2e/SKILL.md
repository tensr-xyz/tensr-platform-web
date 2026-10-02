---
name: tensr-e2e
description: Tensr Playwright. Mocked PR specs, the live Stytch config, and how to add a spec. Use when changing a user-visible flow.
---

# Tensr e2e

Use this for browser tests. Do not install a separate browser CLI.

## Mocked PR suite

- Config: `tensr-platform-web/playwright.config.ts`. `testDir` is `./tests`. Ignores `**/live/**`, `auth.spec.ts`, and unit tests. `webServer` runs `npm run dev` with `E2E_AUTH_BYPASS=true`.
- CI: `tensr-platform-web/.github/workflows/e2e.yml` runs `pnpm run test`, which is `playwright test && playwright test -c playwright.auth.config.ts`. It sets `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` to a `public-token-test-...` placeholder because specs intercept Stytch. That placeholder is public.
- Auth fixture: `tensr-platform-web/tests/fixtures/e2e-auth.ts` sets cookies `stytch_session_token` and `stytch_session_jwt` to the e2e bypass values.
- Examples: `tests/plan-approve-nba.spec.ts`, `tests/referral-journey.spec.ts`, `tests/column-menu-data-ops.spec.ts`.

## Live Stytch suite

- Config: `tensr-platform-web/playwright.live.config.ts`. `testDir` `./tests/live`, `globalSetup` `./tests/live/global-setup.ts`, `baseURL` from `PLAYWRIGHT_LIVE_BASE_URL` (default the development Vercel preview).
- Sign-in: `tests/live/global-setup.ts` needs `STYTCH_TEST_EMAIL` and either `STYTCH_TEST_PASSWORD` or `STYTCH_TEST_OTP`. If those are missing it writes `skipped` into `tests/live/.auth/state.json` and the suite skips.
- CI: `.github/workflows/live-e2e.yml` is `workflow_dispatch` only. It is not part of pull-request CI. It points `PLAYWRIGHT_LIVE_API_URL` at the dev API Gateway.

## Add a spec

1. If the flow can be intercepted, add `tests/<name>.spec.ts` and stub Stytch and `/api/tensr` the way `plan-approve-nba.spec.ts` does. It will run in `pnpm run test`.
2. If it must hit the development preview as a real Stytch user, add `tests/live/<name>.spec.ts` and run `pnpm exec playwright test -c playwright.live.config.ts tests/live/<name>.spec.ts` with the env vars set.
3. Show the Playwright output. A spec that was not executed is not done.

## Pitfall

`playwright.config.ts` starts `npm run dev`. That is the app server, not a reason to wrap the command in tmux. Live specs fail closed when the Stytch test user env is unset; that skip is the setup file, not a pass.
