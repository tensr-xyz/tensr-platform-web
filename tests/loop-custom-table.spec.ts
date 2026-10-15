import path from 'node:path';

import { expect, test } from '@playwright/test';

import { E2E_DATASET_ID, openAnalysisPalette, paletteItem, seedE2eSession, selectPaletteTab } from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

const SAV = path.join(__dirname, 'fixtures/market-demo/cars_EN.sav');
const LOOP_ID = 'aware+likes+owns';

const LOOP = {
  id: LOOP_ID,
  status: 'confirmed',
  partial: false,
  stems: ['aware', 'owns', 'likes'],
  items: ['A', 'B', 'C'],
  item_key: 'item',
  item_title: 'Brand',
  item_labels: { A: 'brand A', B: 'brand B', C: 'brand C' },
  stem_labels: {
    aware: 'Are you aware of',
    owns: 'Do you own',
    likes: 'How much do you like',
  },
  stem_value_labels: {
    aware: { '0': 'No', '1': 'Yes' },
    owns: { '0': 'No', '1': 'Yes' },
    likes: { '1': '1', '2': '2', '3': '3', '4': '4', '5': 'Agree' },
  },
  members: ['aware', 'owns', 'likes'].flatMap(stem =>
    ['A', 'B', 'C'].map(item => ({ column: `${stem}_${item}`, stem, item }))
  ),
};

const PREVIEW_COLUMNS = [
  'id',
  'weight',
  'region',
  'gender',
  'age',
  'Q7',
  ...LOOP.members.map(member => member.column),
];

test('uploads cars_EN.sav, confirms the loop, and tables brands', async ({ page }) => {
  let confirmed = false;
  await seedE2eSession(page);
  await installDatasetApiMocks(page);

  await page.route('**/datasets/upload-url**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mode: 'direct' }),
    });
  });

  await page.route('**/datasets/upload**', async route => {
    if (route.request().url().includes('upload-url')) {
      await route.fallback();
      return;
    }
    const body = route.request().postData() || '';
    if (!body.includes('cars_EN.sav')) {
      await route.fulfill({ status: 400, body: 'expected cars_EN.sav' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        dataset_id: E2E_DATASET_ID,
        original_filename: 'cars_EN.sav',
        n_rows: 300,
        n_cols: PREVIEW_COLUMNS.length,
      }),
    });
  });

  await page.route(`**/datasets/${E2E_DATASET_ID}/preview**`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        headers: PREVIEW_COLUMNS,
        variable_names: PREVIEW_COLUMNS,
        rows: [PREVIEW_COLUMNS.map(() => '1')],
        row_count: 300,
        original_filename: 'cars_EN.sav',
      }),
    });
  });

  await page.route(`**/datasets/${E2E_DATASET_ID}/metadata**`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        dataset_id: E2E_DATASET_ID,
        column_metadata: {},
        columns: [],
        loop_proposals: confirmed ? [] : [{ ...LOOP, status: 'proposal', item_title: undefined }],
        loops: confirmed ? [LOOP] : [],
      }),
    });
  });

  await page.route(`**/datasets/${E2E_DATASET_ID}/loops/${encodeURIComponent(LOOP_ID)}/confirm`, async route => {
    confirmed = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, loop: LOOP }),
    });
  });

  await page.route(`**/datasets/${E2E_DATASET_ID}/loops/${encodeURIComponent(LOOP_ID)}`, async route => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as { item_title?: string };
    LOOP.item_title = body.item_title || 'Brand';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, loop: LOOP }),
    });
  });

  await page.route(`**/datasets/${E2E_DATASET_ID}/versions**`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        origin_dataset_id: E2E_DATASET_ID,
        versions: [
          {
            dataset_id: E2E_DATASET_ID,
            producing_operation: 'weight:design',
            origin_dataset_id: E2E_DATASET_ID,
          },
        ],
      }),
    });
  });

  await page.route(`**/datasets/${E2E_DATASET_ID}/weights/active`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, column: 'weight', warnings: [] }),
    });
  });

  await page.route(`**/datasets/${E2E_DATASET_ID}/tables**`, async route => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ specs: [] }),
      });
      return;
    }
    if (method === 'POST' && url.includes('/tables/preview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ n_banner_columns: 3, warnings: [] }),
      });
      return;
    }
    if (method !== 'POST') {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as {
      level?: string;
      stubs?: Array<{ column?: string }>;
      banner?: Array<{ column?: string }>;
      decimals?: { column_proportion?: number };
    };
    if (body.level !== LOOP_ID) {
      await route.fulfill({ status: 422, body: `level was ${body.level}` });
      return;
    }
    const stubs = (body.stubs || []).map(stub => stub.column);
    if (stubs.join(',') !== 'aware,owns,likes' || body.banner?.[0]?.column !== 'item') {
      await route.fulfill({ status: 422, body: `table was ${JSON.stringify(body)}` });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        spec: {
          id: 'loop-table-1',
          level: LOOP_ID,
          decimals: { column_proportion: body.decimals?.column_proportion ?? 2 },
        },
        loop_table: {
          level: LOOP_ID,
          item_title: 'Brand',
          respondent_unweighted_n: 300,
          respondent_weighted_n: 300,
          paired_across_items: true,
        },
        weight: { column: 'weight', weight_aware: true, unweighted_n: 300 },
        banner_columns: [
          { id: 'total', label: 'Total' },
          { id: 'item=A', label: 'brand A', letter_slot: 'A' },
          { id: 'item=B', label: 'brand B', letter_slot: 'B' },
          { id: 'item=C', label: 'brand C', letter_slot: 'C' },
        ],
        rows: [
          {
            id: 'aware:1',
            label: 'Yes',
            cells: [
              {
                banner_id: 'item=A',
                stub_row_id: 'aware:1',
                percent: 80.4625,
                column_unweighted_n: 300,
                unweighted_n: 242,
                weighted_n: 241.4,
                kish_ess: 280,
              },
              {
                banner_id: 'item=B',
                stub_row_id: 'aware:1',
                percent: 73.0918,
                column_unweighted_n: 300,
                unweighted_n: 219,
                weighted_n: 219.3,
                kish_ess: 270,
              },
              {
                banner_id: 'item=C',
                stub_row_id: 'aware:1',
                percent: 69.7213,
                column_unweighted_n: 300,
                unweighted_n: 209,
                weighted_n: 209.2,
                kish_ess: 260,
              },
            ],
          },
        ],
        letters: [{ stub_row_id: 'aware:1', banner_id: 'item=A', letter: 'b' }],
      }),
    });
  });

  await page.goto('/project/new');
  await page.locator('#new-dataset-file').setInputFiles(SAV);
  await page.getByRole('button', { name: 'Upload and open' }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/dataset/${E2E_DATASET_ID}`), {
    timeout: 30_000,
  });

  await openAnalysisPalette(page);
  await selectPaletteTab(page, 'Analyze');
  await paletteItem(page, 'Custom Tables').click();
  const dialog = page.getByRole('dialog', { name: 'Custom Tables' });
  await expect(dialog.getByText('aware, owns, likes asked for brands A, B, C')).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await dialog.getByRole('radio', { name: 'Brand' }).check();
  await expect(dialog.getByRole('option', { name: 'aware_A' })).toHaveCount(0);
  await expect(dialog.getByRole('option', { name: /Are you aware of/ })).toBeVisible();
  await dialog.getByRole('option', { name: /Are you aware of/ }).click();
  await dialog.getByRole('option', { name: /Do you own/ }).click();
  await dialog.getByRole('option', { name: /How much do you like/ }).click();
  await dialog.getByText('Banner (columns)').click();
  await dialog.getByRole('option', { name: 'Brand', exact: true }).click();
  await dialog.getByLabel('Percent decimals').fill('2');
  await dialog.getByRole('button', { name: 'Run and save' }).click();

  await expect(dialog.getByText('n = 300 respondents')).toBeVisible();
  await expect(dialog.getByText('Significance tests are paired across brands.')).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: /brand A/ })).toContainText('base n=300');
  const awareA = dialog.getByRole('cell', { name: /80\.46%/ });
  await expect(awareA).toBeVisible();
  await expect(awareA.locator('sup')).toHaveText('b');
});
