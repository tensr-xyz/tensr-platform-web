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

  if (method === 'GET' && url.includes(`/datasets/${E2E_DATASET_ID}/preview`)) {
    await json(route, MOCK_PREVIEW);
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
  await page.route('**/api/**', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (/\/api\/(?:tensr\/)?me(?:\?|$)/.test(url) && (method === 'GET' || method === 'PATCH')) {
      await json(route, method === 'PATCH' ? { user: MOCK_ME_PROFILE.user } : MOCK_ME_PROFILE);
      return;
    }

    if (/\/api\/(?:tensr\/)?organizations(?:\?|$|\/)/.test(url) && method === 'GET') {
      await json(route, { organizations: [] });
      return;
    }

    if (await fulfillDatasetRoute(route)) return;
    await route.continue();
  });

  // Local uvicorn dataset paths (no /api prefix).
  await page.route('**/datasets/**', async route => {
    if (route.request().url().includes('/api/')) {
      await route.continue();
      return;
    }
    if (await fulfillDatasetRoute(route)) return;
    await route.continue();
  });

  await page.route('**/projects**', async route => {
    if (route.request().method() === 'GET') {
      await json(route, []);
      return;
    }
    await route.continue();
  });

  await page.route('**/plugins**', async route => {
    if (route.request().method() === 'GET') {
      await json(route, []);
      return;
    }
    await route.continue();
  });
}
