import path from 'node:path';

import { expect, test } from '@playwright/test';

import { openAnalysisPalette, paletteItem, seedE2eSession, selectPaletteTab } from './fixtures/e2e-auth';

const SAV = path.join(__dirname, 'fixtures/market-demo/cars_EN.sav');

test.skip(
  !process.env.PLAYWRIGHT_LIVE_API_URL,
  'Uploads cars_EN.sav to the API and reads the real aware-by-brand table. Set PLAYWRIGHT_LIVE_API_URL.'
);

test('uploads cars_EN.sav, confirms the loop, and tables aware by brand', async ({ page }) => {
  test.setTimeout(90_000);
  await seedE2eSession(page);
  // The branch API's test auth does not attach a paid plan to /api/me, so the
  // subscription gate never opens the form. Upload, confirm, and the table stay
  // on the API named by PLAYWRIGHT_LIVE_API_URL.
  await page.route('**/api/me', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path !== '/api/me' && path !== '/api/tensr/me') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          userId: 'e2e-user',
          email: 'e2e@playwright.test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active',
          subscriptionTier: 'pro',
          subscriptionStatus: 'active',
        },
        entitlements: {
          can_use_ai_assistant: true,
          can_generate_reports: true,
          max_team_seats: 5,
          assistant_limit_monthly: 100,
          assistant_cost_budget_usd_micros_monthly: 1_000_000,
          report_limit_monthly: 100,
          plan_code: 'pro',
        },
        subscription: { status: 'active', plan_code: 'pro' },
      }),
    });
  });

  await page.goto('/project/new');
  await page.locator('#new-dataset-file').setInputFiles(SAV);
  await page.getByRole('button', { name: 'Upload and open' }).click();
  await expect(page).toHaveURL(/\/workspace\/dataset\//, { timeout: 30_000 });

  const loops = page.getByRole('region', { name: 'Loops' });
  await expect(loops.getByText('aware, likes, owns asked for brands A, B, C')).toBeVisible();
  await loops.getByRole('button', { name: 'Confirm' }).click();
  await expect(loops.getByLabel('Brand label')).toHaveValue('Brand');

  await openAnalysisPalette(page);
  await selectPaletteTab(page, 'Analyze');
  await paletteItem(page, 'Custom Tables').click();
  const dialog = page.getByRole('dialog', { name: 'Custom Tables' });
  await dialog.getByRole('radio', { name: 'Brand' }).check();
  await expect(dialog.getByRole('option', { name: 'aware_A' })).toHaveCount(0);
  await dialog.getByRole('option', { name: /Are you aware of/ }).click();
  await dialog.getByText('Banner (columns)').click();
  await dialog.getByRole('option', { name: 'Brand', exact: true }).click();
  await expect(dialog.getByRole('combobox').filter({ hasText: /^weight$/ })).toHaveCount(2);
  await dialog.getByLabel('Percent decimals').fill('2');
  await dialog.getByRole('button', { name: 'Run and save' }).click();

  await expect(dialog.getByText('n = 300 respondents')).toBeVisible();
  await expect(dialog.getByText('Significance tests are paired across brands.')).toBeVisible();
  await expect(dialog.getByText('base n=300').first()).toBeVisible();
  const awareA = dialog.getByRole('cell', { name: /80\.46%/ });
  await expect(awareA).toBeVisible();
  await expect(awareA.locator('sup')).toHaveText(/c/);
});
