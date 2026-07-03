import type { Page } from '@playwright/test';
import { E2E_DATASET_ID } from './e2e-auth';

const MOCK_COLUMNS = ['age', 'group', 'score'];

const MOCK_SCHEMA = {
  n_rows: 3,
  n_cols: 3,
  schema: MOCK_COLUMNS.map(name => ({
    name,
    type: name === 'group' ? 'categorical' : 'numeric',
    missing_count: 0,
  })),
  original_filename: 'e2e-sample.csv',
};

const MOCK_PREVIEW = {
  headers: MOCK_COLUMNS,
  variable_names: MOCK_COLUMNS,
  rows: [
    [25, 'A', 88],
    [30, 'B', 92],
    [28, 'A', 85],
  ],
  row_count: 3,
  original_filename: 'e2e-sample.csv',
};

const MOCK_DESCRIPTIVES_REPORT = {
  meta: {
    analysis_key: 'descriptives',
    title: 'Descriptive Statistics',
    subtitle: 'age, group, score',
    generated_at: new Date().toISOString(),
    rows_dataset: 3,
  },
  summary: 'E2E mock descriptive statistics summary.',
  metrics: [{ label: 'Variables', value: '3' }],
  tables: [
    {
      id: 'describe',
      title: 'Descriptive Statistics',
      columns: ['Variable', 'N', 'Mean', 'Std. Deviation'],
      rows: [
        ['age', '3', '27.667', '2.517'],
        ['score', '3', '88.333', '3.512'],
      ],
    },
  ],
  trust: { notes: [], warnings: [] },
};

const MOCK_ANALYZE_RESPONSE = {
  result: { columns: MOCK_COLUMNS },
  report: MOCK_DESCRIPTIVES_REPORT,
  run_id: 'e2e-run-001',
};

const MOCK_ENTITLEMENTS = {
  can_use_ai_assistant: true,
  can_generate_reports: true,
  max_team_seats: 5,
  assistant_limit_monthly: 100,
  assistant_cost_budget_usd_micros_monthly: 1_000_000,
  report_limit_monthly: 100,
  plan_code: 'pro',
};

const MOCK_ME_PROFILE = {
  user: {
    userId: 'e2e-user',
    email: 'e2e@playwright.test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'active',
    subscriptionTier: 'pro',
    subscriptionStatus: 'active',
  },
  entitlements: MOCK_ENTITLEMENTS,
  subscription: { status: 'active', plan_code: 'pro' },
};

export async function installDatasetApiMocks(page: Page): Promise<void> {
  await page.route('**/api/me**', async route => {
    if (route.request().method() === 'GET' || route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          route.request().method() === 'PATCH' ? { user: MOCK_ME_PROFILE.user } : MOCK_ME_PROFILE
        ),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/organizations**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ organizations: [] }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/projects**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/plugins**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }
    await route.continue();
  });

  const apiPattern = '**/datasets/**';

  await page.route(apiPattern, async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'POST' && url.includes('/upload')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dataset_id: E2E_DATASET_ID }),
      });
      return;
    }

    if (method === 'GET' && url.includes(`/datasets/${E2E_DATASET_ID}/schema`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SCHEMA),
      });
      return;
    }

    if (method === 'GET' && url.includes(`/datasets/${E2E_DATASET_ID}/preview`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PREVIEW),
      });
      return;
    }

    if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/analyze/descriptives`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ANALYZE_RESPONSE),
      });
      return;
    }

    if (method === 'GET' && url.includes(`/datasets/${E2E_DATASET_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dataset_id: E2E_DATASET_ID, ...MOCK_SCHEMA }),
      });
      return;
    }

    if (method === 'GET' && url.includes('/datasets/') && url.includes('/runs')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dataset_id: E2E_DATASET_ID, runs: [] }),
      });
      return;
    }

    await route.continue();
  });
}
