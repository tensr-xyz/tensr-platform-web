import { test, expect } from '@playwright/test';
import {
  E2E_DATASET_ID,
  openAnalysisPalette,
  paletteItem,
  seedE2eSession,
  selectPaletteTab,
} from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

const FR_ID = 'e2e00000-0000-4000-8000-0000000000f1';
const DE_ID = 'e2e00000-0000-4000-8000-0000000000d1';
const STACK_ID = 'e2e00000-0000-4000-8000-000000000900';

const STACK_COLUMNS = ['id', 'Q7', 'source_wave'];

test('stacking three files opens a 900-row dataset with source_wave', async ({ page }) => {
  await seedE2eSession(page);
  await installDatasetApiMocks(page);
  await page.route('**/datasets/**', async route => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === 'GET' && /\/datasets\/?(?:\?|$)/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            dataset_id: E2E_DATASET_ID,
            original_filename: 'cars_EN.sav',
            n_rows: 300,
            n_cols: 3,
            updated_at: '2026-01-01T00:00:00Z',
          },
          {
            dataset_id: FR_ID,
            original_filename: 'cars_FR.sav',
            n_rows: 300,
            n_cols: 3,
            updated_at: '2026-01-02T00:00:00Z',
          },
          {
            dataset_id: DE_ID,
            original_filename: 'cars_DE.sav',
            n_rows: 300,
            n_cols: 3,
            updated_at: '2026-01-03T00:00:00Z',
          },
        ]),
      });
      return;
    }
    if (method === 'POST' && url.includes('/merge')) {
      const body = route.request().postDataJSON() as { preview?: boolean; sources?: unknown[] };
      expect(body.sources).toHaveLength(2);
      if (body.preview) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            preview: true,
            row_count: 900,
            columns: STACK_COLUMNS,
            merge_report: {
              row_count: 900,
              source_wave_column: 'source_wave',
              label_conflicts: [],
            },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          dataset_id: STACK_ID,
          original_filename: 'cars_EN + FR + DE',
          n_rows: 900,
          n_cols: 3,
          preview: {
            headers: STACK_COLUMNS,
            variable_names: STACK_COLUMNS,
            rows: [
              ['EN0001', 5, 'EN'],
              ['FR0001', 1, 'FR'],
            ],
          },
          report: {
            meta: { generated_at: '2026-01-04T00:00:00Z', title: 'Stack' },
            summary: 'Stacked three files.',
          },
        }),
      });
      return;
    }
    if (url.includes(STACK_ID)) {
      if (url.includes('/preview')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            headers: STACK_COLUMNS,
            variable_names: STACK_COLUMNS,
            rows: [
              ['EN0001', 5, 'EN'],
              ['FR0001', 1, 'FR'],
              ['DE0001', 4, 'DE'],
            ],
            row_count: 900,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          dataset_id: STACK_ID,
          original_filename: 'cars_EN + FR + DE',
          n_rows: 900,
          n_cols: 3,
          schema: STACK_COLUMNS.map(name => ({ name, type: 'categorical', missing_count: 0 })),
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=cars_EN.sav`);
  await expect(page.getByText('score', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await openAnalysisPalette(page);
  await selectPaletteTab(page, 'Data');
  await paletteItem(page, 'Merge Datasets').click();
  const dialog = page.getByRole('dialog', { name: 'Merge Datasets' });
  await dialog.getByRole('radio', { name: 'Stack rows (union columns)' }).click();
  await dialog.getByRole('checkbox', { name: 'cars_FR.sav' }).click();
  await dialog.getByRole('checkbox', { name: 'cars_DE.sav' }).click();
  await dialog.getByRole('button', { name: 'Preview match' }).click();
  await expect(dialog.getByText('900 rows in the result.')).toBeVisible();
  await expect(dialog.getByText(/source_wave/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Merge datasets' }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/dataset/${STACK_ID}`));
  await expect(page.getByText('source_wave', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\d+ \/ 900 rows|Total rows: 900/)).toBeVisible();
});
