import { defineConfig, devices } from '@playwright/test';

/**
 * Auth redirect specs must run without E2E_AUTH_BYPASS on the dev server.
 * Main `playwright.config.ts` enables bypass for workspace integration tests.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/auth.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      E2E_AUTH_BYPASS: '',
    },
  },
});
