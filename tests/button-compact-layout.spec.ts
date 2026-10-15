import { test, expect } from '@playwright/test';
import {
  E2E_DATASET_ID,
  openAnalysisPalette,
  paletteItem,
  seedE2eSession,
  selectPaletteTab,
} from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

test.describe('compact buttons after the shadcn swap', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1415, height: 900 });
    await seedE2eSession(page);
    await installDatasetApiMocks(page);
    await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
    await expect(page.getByTestId('column-menu-score')).toBeVisible({ timeout: 60_000 });
  });

  test('column names stay whole, the sort icon stays small, and the user pill fits', async ({
    page,
  }) => {
    for (const name of ['age', 'group', 'score']) {
      const label = page.getByTestId(`column-menu-${name}`).locator('span').first();
      await expect(label).toHaveText(name);
      const truncated = await label.evaluate(
        element => element.scrollWidth > element.clientWidth + 1
      );
      expect(truncated).toBe(false);
    }

    const sortIcon = page.locator('button[title="Numeric column"] svg').first();
    const iconBox = await sortIcon.boundingBox();
    expect(iconBox?.width ?? 99).toBeLessThanOrEqual(12);
    expect(iconBox?.height ?? 99).toBeLessThanOrEqual(12);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1415);

    await page.goto('/dashboard');
    const pill = page.getByRole('button', { name: /e2e@playwright\.test/ });
    await expect(pill).toBeVisible();
    const pillBox = await pill.boundingBox();
    expect(pillBox?.width ?? 999).toBeLessThanOrEqual(164);
    const dashboardScroll = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(dashboardScroll).toBeLessThanOrEqual(1415);

    await page.locator('header').first().screenshot({
      path: 'test-results/compact-app-header.png',
    });
    await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
    await expect(page.getByTestId('column-menu-score')).toBeVisible();
    await page.getByTestId('column-menu-score').screenshot({
      path: 'test-results/compact-column-header.png',
    });
  });

  test('chi-square defaults to the categorical column', async ({ page }) => {
    await openAnalysisPalette(page);
    await selectPaletteTab(page, 'Analyze');
    await paletteItem(page, 'Chi-square').click();
    const dialog = page.getByRole('dialog').last();
    await expect(dialog.getByText('Row variable')).toBeVisible();
    await expect(dialog.getByText('group', { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText('RespID')).toHaveCount(0);
  });
});
