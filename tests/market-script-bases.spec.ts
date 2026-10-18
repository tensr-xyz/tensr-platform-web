import { test, expect } from '@playwright/test';
import {
  E2E_DATASET_ID,
  openAnalysisPalette,
  paletteItem,
  seedE2eSession,
  selectPaletteTab,
} from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

test('data quality report names the reversed FR scale', async ({ page }) => {
  await seedE2eSession(page);
  await installDatasetApiMocks(page);
  await page.route('**/datasets/**/data-quality', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        n_rows: 20,
        n_columns: 4,
        overall_score: 70,
        summary: 'Script check found a market problem.',
        columns: [],
        script_findings: [
          {
            market: 'FR',
            variable: 'Q7',
            count: 10,
            kind: 'reversed_scale',
            message: 'FR scale looks reversed on Q7.',
          },
        ],
      }),
    });
  });
  await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
  await expect(page.getByText('score', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await openAnalysisPalette(page);
  await selectPaletteTab(page, 'Data');
  await paletteItem(page, 'Data Quality Report').click();
  await expect(page.getByRole('dialog')).toContainText('FR scale looks reversed on Q7.');
});
