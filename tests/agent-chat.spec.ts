import { test, expect } from '@playwright/test';
import { E2E_DATASET_ID, seedE2eSession } from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

/** Workspace route smoke with E2E auth bypass + API mocks. */
test.describe('Agent panel smoke', () => {
  test('dataset workspace route loads without redirecting to login', async ({ page }) => {
    await seedE2eSession(page);
    await installDatasetApiMocks(page);
    await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
    await expect(page).toHaveTitle(/Tensr/i);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
