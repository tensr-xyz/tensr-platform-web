import { test, expect } from '@playwright/test';
import {
  E2E_DATASET_ID,
  openAnalysisPalette,
  paletteItem,
  selectPaletteTab,
  seedE2eSession,
} from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

test.describe('Descriptive statistics journey', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSession(page);
    await installDatasetApiMocks(page);
    await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
    await expect(page.getByText('age', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  });

  test('runs descriptives and renders the analysis report', async ({ page }) => {
    test.setTimeout(120_000);

    await openAnalysisPalette(page);
    await selectPaletteTab(page, 'Analyze');
    await paletteItem(page, 'Descriptives').click();

    const setupDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: 'Run analysis' }) });
    await expect(setupDialog).toBeVisible();
    await setupDialog.getByRole('button', { name: 'Run analysis' }).click();

    await expect(page.getByText('Results loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText('Descriptive Statistics').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('E2E mock descriptive statistics summary.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy' }).first()).toBeVisible();

    const excelRequest = page.waitForRequest(
      request => request.method() === 'POST' && request.url().includes('/reports/export.xlsx')
    );
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('menuitem', { name: 'Excel' }).click();
    const excel = await excelRequest;
    const body = excel.postDataJSON();
    expect(body.dataset_id).toBe(E2E_DATASET_ID);
    expect(body.report.tables.length).toBeGreaterThan(0);
    expect(body.report.meta).toBeTruthy();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.xlsx');
  });
});
