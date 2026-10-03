import { defineConfig, devices } from '@playwright/test';

const baseURL =
  process.env.PLAYWRIGHT_LIVE_BASE_URL ||
  'https://tensr-platform-web-git-development-tensr.vercel.app';

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

export default defineConfig({
  testDir: './tests/live',
  fullyParallel: false,
  retries: 1,
  timeout: 120_000,
  globalSetup: './tests/live/global-setup.ts',
  reporter: 'html',
  use: {
    baseURL,
    storageState: 'tests/live/.auth/state.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: bypass
      ? {
          'x-vercel-protection-bypass': bypass,
          'x-vercel-set-bypass-cookie': 'true',
        }
      : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
