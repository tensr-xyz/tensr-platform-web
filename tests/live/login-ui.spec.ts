import { expect, test } from '@playwright/test';

/**
 * Logged-out email login. This does not use the sandbox session from global setup.
 *
 * Open the dev server as localhost. Next.js blocks dev resources for 127.0.0.1,
 * the form never hydrates, and Continue (type="submit", method defaults to GET)
 * navigates to /login? without calling Stytch.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test('email continue shows the verification code step', async ({ page }) => {
  await page.goto('/login');
  await page.waitForFunction(() => {
    const button = document.querySelector('form button[type="submit"]');
    if (!button) return false;
    return Object.getOwnPropertyNames(button).some(key => key.startsWith('__react'));
  });
  await page.getByLabel('Email').fill('sandbox@stytch.com');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await expect(page).not.toHaveURL(/\/login\?/);
  await expect(page.getByLabel(/verification code/i)).toBeVisible();
});
