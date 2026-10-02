import type { Page, Route } from '@playwright/test';
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

const MOCK_COMPUTED_DATASET_ID = 'e5d1c555-9f80-497d-b0fb-2bfa07983d4c';
const MOCK_SHIFTED_DATASET_ID = 'a1b2c3d4-1111-4111-8111-111111111111';
const MOCK_OUTLIER_DATASET_ID = 'b1b2c3d4-2222-4222-8222-222222222222';
const MOCK_CATEGORY_DATASET_ID = 'c1c2c3d4-3333-4333-8333-333333333333';

const MOCK_COMPUTE_RESPONSE = {
  dataset_id: MOCK_COMPUTED_DATASET_ID,
  original_filename: 'e2e-sample_computed.csv',
  n_rows: 3,
  n_cols: 4,
  preview: {
    headers: ['age', 'group', 'score', 'age_plus_score'],
    variable_names: ['age', 'group', 'score', 'age_plus_score'],
    rows: [
      [25, 'A', 88, 113],
      [30, 'B', 92, 122],
      [28, 'A', 85, 113],
    ],
    columns: [
      { name: 'age', type: 'numeric' },
      { name: 'group', type: 'string' },
      { name: 'score', type: 'numeric' },
      { name: 'age_plus_score', type: 'numeric' },
    ],
  },
};

const MOCK_SHIFT_RESPONSE = {
  dataset_id: MOCK_SHIFTED_DATASET_ID,
  original_filename: 'e2e-sample_lag.csv',
  n_rows: 3,
  n_cols: 4,
  preview: {
    headers: ['age', 'group', 'score', 'score_lag1'],
    variable_names: ['age', 'group', 'score', 'score_lag1'],
    rows: [
      [25, 'A', 88, null],
      [30, 'B', 92, 88],
      [28, 'A', 85, 92],
    ],
    columns: [
      { name: 'age', type: 'numeric' },
      { name: 'group', type: 'string' },
      { name: 'score', type: 'numeric' },
      { name: 'score_lag1', type: 'numeric' },
    ],
  },
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

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function columnFrequencies(column: string) {
  if (column === 'group') {
    return [
      { value: 'A', count: 2, percentage: 2 / 3 },
      { value: 'B', count: 1, percentage: 1 / 3 },
    ];
  }
  if (column === 'score') {
    return [
      { value: '85', count: 1, percentage: 1 / 3 },
      { value: '88', count: 1, percentage: 1 / 3 },
      { value: '92', count: 1, percentage: 1 / 3 },
    ];
  }
  return [
    { value: '25', count: 1, percentage: 1 / 3 },
    { value: '28', count: 1, percentage: 1 / 3 },
    { value: '30', count: 1, percentage: 1 / 3 },
  ];
}

/** Handle dataset CRUD/explore paths for both /api/tensr/datasets and uvicorn /datasets. */
async function fulfillDatasetRoute(route: Route): Promise<boolean> {
  const url = route.request().url();
  const method = route.request().method();
  if (!url.includes('/datasets')) return false;

  if (method === 'POST' && url.includes('/upload')) {
    await json(route, { dataset_id: E2E_DATASET_ID });
    return true;
  }

  if (method === 'GET' && url.includes(`/datasets/${E2E_DATASET_ID}/schema`)) {
    await json(route, MOCK_SCHEMA);
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/script`)) {
    await json(route, {
      ok: true,
      language: 'r',
      r_script: 'library(haven)\ndf <- haven::read_sav("wave.sav")\n',
    });
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/weights/poststratify`)) {
    await json(route, {
      ok: true,
      dataset_id: E2E_DATASET_ID,
      derived_dataset_id: E2E_DATASET_ID,
      original_filename: 'e2e-sample.csv',
      n_rows: 3,
      n_cols: 3,
      diagnostics: {
        kish_ess: 2.5,
        deff: 1.2,
        weighting_efficiency: 0.83,
        min_weight: 0.8,
        max_weight: 1.4,
      },
    });
    return true;
  }

  if (method === 'GET' && url.includes(`/datasets/${E2E_DATASET_ID}/preview`)) {
    await json(route, MOCK_PREVIEW);
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/compute`)) {
    await json(route, MOCK_COMPUTE_RESPONSE);
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/find-outliers`)) {
    await json(route, {
      n_rows: 3,
      total_flagged_rows: 1,
      affected_row_indices: [2],
      columns: [
        {
          column: 'score',
          method: 'iqr',
          lower_bound: 80,
          upper_bound: 95,
          outlier_count: 1,
          pct_of_rows: 33.33,
          sample_row_indices: [2],
        },
      ],
    });
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/handle-outliers`)) {
    await json(route, {
      dataset_id: MOCK_OUTLIER_DATASET_ID,
      parent_dataset_id: E2E_DATASET_ID,
      original_filename: 'e2e-sample_outliers_flag.csv',
      n_rows: 3,
      n_cols: 4,
      provenance: { dataset_id: MOCK_OUTLIER_DATASET_ID },
      preview: {
        headers: ['age', 'group', 'score', 'score_outlier'],
        variable_names: ['age', 'group', 'score', 'score_outlier'],
        rows: [
          [25, 'A', 88, false],
          [30, 'B', 92, false],
          [28, 'A', 85, true],
        ],
        columns: [
          { name: 'age', type: 'numeric' },
          { name: 'group', type: 'string' },
          { name: 'score', type: 'numeric' },
          { name: 'score_outlier', type: 'boolean' },
        ],
      },
    });
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/clean-categories/preview`)) {
    await json(route, {
      column: 'group',
      summary: '1 merge(s) proposed for group.',
      mappings: [
        {
          from: ['Male', 'male '],
          to: 'Male',
          reason: 'Same text after trimming whitespace and ignoring case',
        },
      ],
      suggestions: [
        {
          from: ['UK', 'U.K.', 'United Kingdom'],
          to: 'United Kingdom',
          reason: 'Abbreviation',
          tier: 'fuzzy',
        },
      ],
      labels_for_model: ['Male', 'male ', 'UK', 'U.K.', 'United Kingdom'],
      model: {
        used: false,
        sent: 'distinct_labels_only',
        label_count: 5,
        notice:
          'Semantic suggestions use only the distinct category labels. Respondent rows are not sent to the model.',
      },
    });
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/clean-categories/suggest`)) {
    await json(route, {
      column: 'group',
      suggestions: [
        {
          from: ['Coke', 'Coca-Cola'],
          to: 'Coke',
          reason: 'brand',
          tier: 'semantic',
        },
      ],
      model: {
        used: true,
        sent: 'distinct_labels_only',
        label_count: 5,
        notice:
          'Semantic suggestions use only the distinct category labels. Respondent rows are not sent to the model.',
      },
    });
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/clean-categories`)) {
    await json(route, {
      dataset_id: MOCK_CATEGORY_DATASET_ID,
      parent_dataset_id: E2E_DATASET_ID,
      original_filename: 'e2e-sample_categories.csv',
      n_rows: 3,
      n_cols: 3,
      provenance: { dataset_id: MOCK_CATEGORY_DATASET_ID },
      preview: {
        headers: ['age', 'group', 'score'],
        variable_names: ['age', 'group', 'score'],
        rows: [
          [25, 'Male', 88],
          [30, 'Male', 92],
          [28, 'Male', 85],
        ],
        columns: [
          { name: 'age', type: 'numeric' },
          { name: 'group', type: 'string' },
          { name: 'score', type: 'numeric' },
        ],
      },
    });
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/shift`)) {
    await json(route, MOCK_SHIFT_RESPONSE);
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/analyze/descriptives`)) {
    await json(route, MOCK_ANALYZE_RESPONSE);
    return true;
  }

  if (method === 'POST' && url.includes(`/datasets/${E2E_DATASET_ID}/explore/column_frequencies`)) {
    let column = 'age';
    try {
      const body = route.request().postDataJSON() as { column?: string };
      if (body?.column) column = body.column;
    } catch {
      /* ignore */
    }
    await json(route, {
      frequencies: columnFrequencies(column),
      column_type: column === 'group' ? 'categorical' : 'numeric',
      missing_count: 0,
      total_count: 3,
    });
    return true;
  }

  if (method === 'GET' && url.includes(`/datasets/${E2E_DATASET_ID}/runs`)) {
    await json(route, { dataset_id: E2E_DATASET_ID, runs: [] });
    return true;
  }

  if (
    method === 'GET' &&
    url.includes(`/datasets/${E2E_DATASET_ID}`) &&
    !url.includes('/columns') &&
    !url.includes('/rows')
  ) {
    await json(route, { dataset_id: E2E_DATASET_ID, ...MOCK_SCHEMA });
    return true;
  }

  if (method === 'GET' && /\/datasets\/?(?:\?|$)/.test(url)) {
    await json(route, [{ dataset_id: E2E_DATASET_ID, ...MOCK_SCHEMA }]);
    return true;
  }

  return false;
}

export async function installDatasetApiMocks(page: Page): Promise<void> {
  // Catch same-origin proxy (/api/tensr/me) AND local uvicorn (/api/me).
  // Previous glob **/api/me** did NOT match /api/tensr/me → 401 → bounce to login.
  await page.route('**/reports/export.xlsx', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      headers: { 'Content-Disposition': 'attachment; filename="report.xlsx"' },
      body: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    });
  });

  await page.route('**/api/**', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'POST' && url.includes('/reports/export.xlsx')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'Content-Disposition': 'attachment; filename="report.xlsx"' },
        body: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      });
      return;
    }

    if (/\/api\/(?:tensr\/)?me(?:\?|$)/.test(url) && (method === 'GET' || method === 'PATCH')) {
      await json(route, method === 'PATCH' ? { user: MOCK_ME_PROFILE.user } : MOCK_ME_PROFILE);
      return;
    }

    if (/\/api\/(?:tensr\/)?organizations(?:\?|$|\/)/.test(url) && method === 'GET') {
      await json(route, { organizations: [] });
      return;
    }

    if (/\/api\/(?:tensr\/)?sessions(?:\?|$)/.test(url) && method === 'GET') {
      await json(route, []);
      return;
    }

    if (await fulfillDatasetRoute(route)) return;

    // The fake session token is always rejected by a real tensr-api, and any 401
    // logs the test user out — so unmocked backend calls must never leave the browser.
    if (url.includes('/api/tensr/')) {
      await json(route, { detail: `Not mocked in E2E: ${method} ${url}` }, 404);
      return;
    }
    await route.continue();
  });

  // `fallback()` (not `continue()`) so requests reach the `**/api/**` handler above;
  // `continue()` sends them straight to the network.
  await page.route('**/datasets/**', async route => {
    if (route.request().url().includes('/api/')) {
      await route.fallback();
      return;
    }
    if (await fulfillDatasetRoute(route)) return;
    await route.fallback();
  });

  await page.route('**/projects**', async route => {
    if (route.request().method() === 'GET' && route.request().resourceType() !== 'document') {
      await json(route, []);
      return;
    }
    await route.fallback();
  });

  await page.route('**/plugins**', async route => {
    if (route.request().method() === 'GET' && route.request().resourceType() !== 'document') {
      await json(route, []);
      return;
    }
    await route.fallback();
  });
}
