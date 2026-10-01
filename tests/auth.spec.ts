import { test, expect, type Page } from '@playwright/test';

test.describe('Auth redirects', () => {
  test('redirects /dashboard to /login when there is no session', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/returnTo=%2Fdashboard/);
  });
});

/** Stytch SDK error envelope (non-200 + JSON → thrown StytchAPIError). */
function stytchError(status: number, error_type: string, error_message: string) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      status_code: status,
      request_id: 'request-id-test-e2e',
      error_type,
      error_message,
      error_url: `https://stytch.com/docs/api/errors/${status}`,
    }),
  };
}

/** Stytch SDK success envelope: the client unwraps `data`. */
function stytchOk(data: Record<string, unknown>) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: { status_code: 200, request_id: 'request-id-test-e2e', ...data },
    }),
  };
}

async function gotoLogin(page: Page, query = '') {
  await page.context().clearCookies();
  await page.goto(`/login${query}`);
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
}

test.describe('Login page', () => {
  test('offers Google, GitHub and email sign-in', async ({ page }) => {
    await gotoLogin(page);
    await expect(page.getByRole('button', { name: /continue with github/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /^continue$/i })).toBeVisible();
  });

  for (const provider of ['google', 'github'] as const) {
    test(`${provider} button hands off to Stytch with /login as the redirect`, async ({
      page,
      baseURL,
    }) => {
      let startUrl: URL | null = null;
      await page.route(`**/v1/public/oauth/${provider}/start**`, route => {
        startUrl = new URL(route.request().url());
        return route.fulfill({ status: 200, contentType: 'text/html', body: 'stytch-oauth' });
      });

      await gotoLogin(page);
      await page
        .getByRole('button', { name: new RegExp(`continue with ${provider}`, 'i') })
        .click();

      await expect.poll(() => startUrl?.toString() ?? null, { timeout: 15_000 }).not.toBeNull();
      const expectedRedirect = new URL('/login', baseURL).toString();
      expect(startUrl!.searchParams.get('public_token')).toBeTruthy();
      expect(startUrl!.searchParams.get('login_redirect_url')).toBe(expectedRedirect);
      expect(startUrl!.searchParams.get('signup_redirect_url')).toBe(expectedRedirect);
    });
  }

  test('OAuth callback with an expired token explains what to do', async ({ page }) => {
    await page.route('**/sdk/v1/oauth/authenticate**', route =>
      route.fulfill(
        stytchError(404, 'oauth_token_not_found', 'The OAuth token could not be found.')
      )
    );

    await gotoLogin(page, '?stytch_token_type=oauth&token=expired-token');

    await expect(
      page.getByText('That sign-in link has expired. Please try signing in again.')
    ).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/request_id|stytch\.com\/docs/);
  });

  test('email OTP: sends a code, then explains a wrong code', async ({ page }) => {
    let sentTo: string | null = null;
    await page.route('**/sdk/v1/otps/email/login_or_create**', route => {
      sentTo = (route.request().postDataJSON() as { email?: string })?.email ?? null;
      return route.fulfill(
        stytchOk({ user_id: 'user-test-e2e', email_id: 'email-test-e2e', user_created: false })
      );
    });
    await page.route('**/sdk/v1/otps/authenticate**', route =>
      route.fulfill(stytchError(404, 'otp_code_not_found', 'The OTP code could not be found.'))
    );

    await gotoLogin(page);
    await page.getByLabel('Email').fill('  E2E@Example.com ');
    await page.getByRole('button', { name: /^continue$/i }).click();

    await expect(page.getByLabel('Verification Code')).toBeVisible();
    expect(sentTo).toBe('e2e@example.com');

    await page.getByLabel('Verification Code').fill('000000');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/that code is incorrect or has expired/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });

  test('email OTP: invalid email is reported without leaving the email step', async ({ page }) => {
    await page.route('**/sdk/v1/otps/email/login_or_create**', route =>
      route.fulfill(stytchError(400, 'invalid_email', 'Email format is invalid.'))
    );

    await gotoLogin(page);
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: /^continue$/i }).click();

    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
    await expect(page.getByLabel('Verification Code')).toHaveCount(0);
  });
});
