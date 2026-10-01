import { test, expect } from '@playwright/test';
import { E2E_DATASET_ID, seedE2eSession } from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

test.describe('Column menu data ops', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSession(page);
    await installDatasetApiMocks(page);
    await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
    await expect(page.getByText('score', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  });

  test('Find outliers highlights rows and flag saves a derived dataset', async ({ page }) => {
    test.setTimeout(90_000);
    const aiCalls: string[] = [];
    page.on('request', request => {
      if (
        request.url().includes('/ai/detect-outliers') ||
        request.url().includes('/ai/clean-categories')
      ) {
        aiCalls.push(request.url());
      }
    });

    const findRequest = page.waitForRequest(
      request => request.method() === 'POST' && request.url().includes('/find-outliers')
    );
    await page.getByTestId('column-menu-score').click();
    await page.getByTestId('column-menu-find-outliers').click();
    const find = await findRequest;
    expect(find.url()).toContain(`/datasets/${E2E_DATASET_ID}/find-outliers`);
    expect(find.postDataJSON()).toEqual({ columns: ['score'] });

    await expect(page.getByTestId('outlier-actions')).toContainText('Flagged 1 of 3');
    await expect(page.locator('[data-outlier-row="true"]')).toHaveCount(1);

    const handleRequest = page.waitForRequest(
      request => request.method() === 'POST' && request.url().includes('/handle-outliers')
    );
    await page.getByTestId('outlier-action-flag').click();
    const handle = await handleRequest;
    expect(handle.url()).toContain(`/datasets/${E2E_DATASET_ID}/handle-outliers`);
    expect(handle.postDataJSON()).toEqual({ columns: ['score'], method: 'flag' });
    await expect(page.getByText('score_outlier', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(aiCalls).toEqual([]);
  });

  test('Clean categories previews merges and apply saves a derived dataset', async ({ page }) => {
    test.setTimeout(90_000);
    const aiCalls: string[] = [];
    page.on('request', request => {
      if (
        request.url().includes('/ai/detect-outliers') ||
        request.url().includes('/ai/clean-categories')
      ) {
        aiCalls.push(request.url());
      }
    });

    const previewRequest = page.waitForRequest(
      request => request.method() === 'POST' && request.url().includes('/clean-categories/preview')
    );
    await page.getByTestId('column-menu-group').click();
    await page.getByTestId('column-menu-clean-categories').click();
    const preview = await previewRequest;
    expect(preview.url()).toContain(`/datasets/${E2E_DATASET_ID}/clean-categories/preview`);
    expect(preview.postDataJSON()).toEqual({ column: 'group' });

    const dialog = page.getByTestId('clean-categories-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('male ');
    await expect(dialog.getByRole('textbox')).toHaveValue('Male');
    await expect(dialog.getByTestId('clean-categories-suggestions')).toContainText(
      'United Kingdom'
    );
    await expect(dialog.getByTestId('clean-categories-model-notice')).toHaveCount(0);
    await expect(dialog.getByTestId('clean-categories-model-labels')).toContainText(
      'United Kingdom'
    );

    const suggestRequest = page.waitForRequest(
      request => request.method() === 'POST' && request.url().includes('/clean-categories/suggest')
    );
    await page.getByTestId('clean-categories-suggest-ai').click();
    const suggest = await suggestRequest;
    expect(suggest.postDataJSON()).toEqual({ column: 'group' });
    await expect(dialog.getByTestId('clean-categories-model-notice')).toContainText(
      'distinct category labels'
    );
    await expect(dialog.getByTestId('clean-categories-suggestions')).toContainText('Coca-Cola');

    const applyRequest = page.waitForRequest(
      request =>
        request.method() === 'POST' &&
        request.url().includes('/clean-categories') &&
        !request.url().includes('/preview') &&
        !request.url().includes('/suggest')
    );
    await page.getByTestId('clean-categories-apply').click();
    const apply = await applyRequest;
    const applied = apply.postDataJSON();
    expect(applied).toMatchObject({
      column: 'group',
      mappings: [{ from: ['Male', 'male '], to: 'Male' }],
    });
    expect(JSON.stringify(applied)).not.toContain('United Kingdom');
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Male', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    expect(aiCalls).toEqual([]);
  });
});
