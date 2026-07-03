import { defineConfig, devices } from '@playwright/test';

/**
 * Launch gate: critical user journeys only (no collaboration, multi-file projects, or marketplace E2E).
 * Full suite: `pnpm test` in tensr-platform-web.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: [
    '**/analysis-descriptives.spec.ts',
    '**/analyze-menu.spec.ts',
    '**/agent-chat.spec.ts',
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 120_000,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      E2E_AUTH_BYPASS: 'true',
    },
  },
});
