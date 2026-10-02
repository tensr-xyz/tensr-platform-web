import { test, expect, type Page, type Route } from '@playwright/test';
import { seedE2eSession } from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

/**
 * Mocked tier: the referral API is an in-test state machine that follows the tensr-api rules
 * (attribution at signup, rewards only once the referee's first payment succeeds). Stytch sign-up
 * and the Stripe test-mode webhook are outside the browser, so they are simulated by seeding a
 * session and calling `stripeInvoicePaid()`.
 */
const CODE = 'TENSR-E2E0000001';

type Role = 'referrer' | 'referee';

class ReferralApiState {
  attributedCode: string | null = null;
  paid = false;

  stripeInvoicePaid(): void {
    if (this.attributedCode) this.paid = true;
  }

  panel(role: Role) {
    const reward = {
      referrer_months: 1,
      referee_months: 1,
      cap_months: 6,
      cap_window_days: 365,
      reversal_window_days: 30,
      attribution_window_days: 30,
      excluded_plans: ['teams'],
    };
    const granted = this.paid ? 'granted' : null;
    if (role === 'referee') {
      return {
        enabled: true,
        code: 'TENSR-E2E0000002',
        link_path: '/login?ref=TENSR-E2E0000002',
        reward,
        referrals: [],
        months_earned: 0,
        referred_by: this.attributedCode
          ? {
              status: this.paid ? 'reward_granted' : 'trialling',
              reward_status: granted,
              reward_months: this.paid ? 1 : 0,
              reward_granted_at: null,
            }
          : null,
      };
    }
    return {
      enabled: true,
      code: CODE,
      link_path: `/login?ref=${CODE}`,
      reward,
      referrals: this.attributedCode
        ? [
            {
              id: 'row-b',
              referee: 'bo***@other.test',
              status: this.paid ? 'reward_granted' : 'trialling',
              signed_up_at: null,
              paid_at: null,
              reward_status: granted,
              reward_months: this.paid ? 1 : 0,
              reward_granted_at: null,
            },
          ]
        : [],
      months_earned: this.paid ? 1 : 0,
      referred_by: null,
    };
  }
}

async function installReferralApi(page: Page, state: ReferralApiState, role: Role): Promise<void> {
  await page.route('**/billing/referral**', async (route: Route) => {
    const request = route.request();
    if (request.method() === 'POST' && request.url().includes('/attribute')) {
      const body = request.postDataJSON() as { code?: string };
      if (role !== 'referee' || body.code !== CODE) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: '{"detail":"self_referral"}',
        });
        return;
      }
      state.attributedCode = body.code;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ attributed: true, status: 'signed_up' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.panel(role)),
    });
  });
}

async function openReferPanel(page: Page) {
  await page.getByRole('button', { name: 'Refer' }).click();
  return page.getByRole('dialog').filter({ hasText: 'Refer a colleague' });
}

test.describe('Referral journey', () => {
  test('A copies link, B signs up through it and pays, both see the reward', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const state = new ReferralApiState();

    const contextA = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const pageA = await contextA.newPage();
    await seedE2eSession(pageA);
    await installDatasetApiMocks(pageA);
    await installReferralApi(pageA, state, 'referrer');
    await pageA.goto('/dashboard');

    let panelA = await openReferPanel(pageA);
    await expect(panelA.getByLabel('Your referral link')).toHaveValue(
      new RegExp(`/login\\?ref=${CODE}$`),
      {
        timeout: 60_000,
      }
    );
    await expect(
      panelA.getByText(/You both get 1 month free once they make their first payment/)
    ).toBeVisible();
    await expect(panelA.getByText('No referrals yet.')).toBeVisible();
    await panelA.getByRole('button', { name: 'Copy referral link' }).click();
    await expect(panelA.getByText('Copied')).toBeVisible();
    const copiedLink = await pageA.evaluate(() => navigator.clipboard.readText());
    expect(copiedLink).toContain(`/login?ref=${CODE}`);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await installDatasetApiMocks(pageB);
    await installReferralApi(pageB, state, 'referee');
    const link = new URL(copiedLink);
    await pageB.goto(`${link.pathname}${link.search}`);
    await expect
      .poll(() => pageB.evaluate(() => localStorage.getItem('tensr_pending_referral')), {
        timeout: 60_000,
      })
      .toContain(CODE);
    expect(state.attributedCode).toBeNull();

    await seedE2eSession(pageB);
    await pageB.goto('/login');
    await expect.poll(() => state.attributedCode, { timeout: 60_000 }).toBe(CODE);
    await expect(pageB).toHaveURL(/\/dashboard/, { timeout: 60_000 });
    expect(await pageB.evaluate(() => localStorage.getItem('tensr_pending_referral'))).toBeNull();

    await pageA.reload();
    panelA = await openReferPanel(pageA);
    await expect(panelA.getByRole('list', { name: 'Referrals' })).toContainText('Trialling');

    state.stripeInvoicePaid();

    const panelB = await openReferPanel(pageB);
    await expect(panelB.getByTestId('referral-referred-by')).toHaveText(
      'Your reward: 1 month free, credited to your next invoice.'
    );

    await pageA.reload();
    panelA = await openReferPanel(pageA);
    await expect(panelA.getByRole('list', { name: 'Referrals' })).toContainText('Reward granted');
    await expect(panelA.getByText(/1 month earned/)).toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});
