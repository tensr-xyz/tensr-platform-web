import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const state = JSON.parse(fs.readFileSync(path.join(__dirname, '.auth', 'state.json'), 'utf8')) as {
  cookies?: unknown[];
  skipped?: string;
};

const apiBase =
  process.env.PLAYWRIGHT_LIVE_API_URL || 'https://5qv9lg3s55.execute-api.us-east-1.amazonaws.com';

test.beforeEach(() => {
  test.skip(Boolean(state.skipped), state.skipped || 'Stytch test login is not configured');
});

test('signed-in home is the development preview', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).not.toHaveURL(/\/login/);
});

test('dev API health route is the configured gateway', async ({ request }) => {
  const response = await request.get(`${apiBase}/api/datasets`, { failOnStatusCode: false });
  expect([200, 401, 403]).toContain(response.status());
});

test('workspace can open after sign-in', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(
    page
      .getByRole('navigation')
      .or(page.getByText(/project|dataset/i))
      .first()
  ).toBeVisible();
});
