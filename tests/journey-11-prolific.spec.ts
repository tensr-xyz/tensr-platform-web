import { test, expect } from '@playwright/test';
import {
  E2E_DATASET_ID,
  openAnalysisPalette,
  paletteItem,
  selectPaletteTab,
  seedE2eSession,
} from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

test.describe('Journey 11 — weight, then export the pipeline script', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSession(page);
    await installDatasetApiMocks(page);
    await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
    await expect(page.getByText('age', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  });

  test('cell weighting and the combined R script are available', async ({ page }) => {
    test.setTimeout(90_000);
    await openAnalysisPalette(page);
    await selectPaletteTab(page, 'Data');
    await paletteItem(page, 'Cell weighting').click();
    const weighting = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Cell weighting' }),
    });
    await expect(weighting).toBeVisible();
    await weighting
      .getByRole('button', { name: 'Close' })
      .click()
      .catch(async () => {
        await page.keyboard.press('Escape');
      });

    await openAnalysisPalette(page);
    await selectPaletteTab(page, 'Data');
    await paletteItem(page, 'Export R script').click();
    const script = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Export R script' }),
    });
    await expect(script).toBeVisible();
    await expect(script.locator('textarea')).toHaveValue(/haven::read_sav/, { timeout: 15_000 });
  });
});
