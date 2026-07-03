import { test, expect } from '@playwright/test';

test.describe('Auth redirects', () => {
  test('redirects /dashboard to /login when there is no session', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/returnTo=%2Fdashboard/);
  });
});
