import { defineConfig, devices } from '@playwright/test';

/**
 * Full workspace stress suite (sheet chrome, cells, column menus, filters, nav).
 *
 * Prefer an already-running `pnpm dev` on :3000 (Next only allows one next-dev
 * per project dir). Auth is satisfied via seeded cookies + API mocks that cover
 * both `/api/me` and `/api/tensr/me`.
 *
 * If tests bounce to /login, restart the app with:
 *   E2E_AUTH_BYPASS=true pnpm dev
 *
 * Run: `pnpm test:workspace`
 */
export default defineConfig({
  testDir: './tests',
  testMatch: ['**/workspace-stress.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'E2E_AUTH_BYPASS=true pnpm exec next dev -p 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      E2E_AUTH_BYPASS: 'true',
    },
  },
});
