import { test, expect } from '@playwright/test';
import {
  analysisPalette,
  E2E_DATASET_ID,
  openAnalysisPalette,
  selectPaletteTab,
  seedE2eSession,
} from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

test.describe('Compute Variable and Shift Values', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSession(page);
    await installDatasetApiMocks(page);
    await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
    await expect(page.getByText('age', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  });

  test('Compute Variable creates a column that appears in the sheet', async ({ page }) => {
    test.setTimeout(90_000);
    await openAnalysisPalette(page);
    await selectPaletteTab(page, 'Transform');
    await analysisPalette(page)
      .getByRole('button', { name: 'Compute Variable', exact: true })
      .click();

    const dialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Compute Variable' }),
    });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('New variable name').fill('age_plus_score');
    await dialog.getByPlaceholder('age + score').fill('age + score');
    await dialog.getByRole('button', { name: 'Compute Variable' }).click();

    await expect(page.getByText('age_plus_score', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('Shift Values creates a lagged column that appears in the sheet', async ({ page }) => {
    test.setTimeout(90_000);
    await openAnalysisPalette(page);
    await selectPaletteTab(page, 'Transform');
    await analysisPalette(page).getByRole('button', { name: 'Shift Values', exact: true }).click();

    const dialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Shift Values' }),
    });
    await expect(dialog).toBeVisible();
    await dialog.locator('label', { hasText: 'score' }).click();
    await dialog.getByRole('button', { name: 'Shift Values' }).click();

    await expect(page.getByText('score_lag1', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
