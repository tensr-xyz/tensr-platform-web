import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { E2E_DATASET_ID, seedE2eSession } from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

const PROMPT = 'what predicts points independent of shot volume';
const SUMMARY =
  'Holding shot volume aside, age and minutes predict points per game (R² = 0.62, n = 572).';

const REPORT = {
  meta: {
    analysis_key: 'linear_regression',
    title: 'Linear Regression',
    subtitle: 'PTS ~ Age + MP',
    generated_at: '2026-10-02T00:00:00Z',
    rows_dataset: 572,
  },
  summary: SUMMARY,
  metrics: [
    { label: 'R²', value: '0.620', emphasis: true },
    { label: 'Adjusted R²', value: '0.618' },
    { label: 'F', value: '463.2' },
    { label: 'p-value', value: '< .001' },
  ],
  tables: [
    {
      id: 'regression_coef',
      title: 'Coefficients',
      columns: ['Term', 'B', 'SE', 't', 'p'],
      rows: [
        ['(Intercept)', '4.12', '0.81', '5.09', '< .001'],
        ['Age', '-0.18', '0.04', '-4.50', '< .001'],
        ['MP', '0.41', '0.02', '20.50', '< .001'],
      ],
    },
  ],
  trust: { notes: [], warnings: [] },
};

const REQUEST_BODY = {
  dependent: 'PTS',
  independents: ['Age', 'MP'],
};

function approvalResponse() {
  return {
    status: 'awaiting_approval',
    mode: 'plan',
    answer_markdown:
      '**Plan:** Regress points on age and minutes, leaving shot volume out.\n\n**Why this test:** Points are continuous, so linear regression estimates the partial association.',
    pending_approvals: [
      {
        tool_call_id: 'call_nba_pts',
        name: 'run_analysis',
        args: {
          analysis_type: 'linear_regression',
          rationale: 'Regress points on age and minutes, leaving shot volume out.',
          why_this_test:
            'Points are continuous, so linear regression estimates the partial association.',
          request_body: REQUEST_BODY,
        },
        rationale: 'Regress points on age and minutes, leaving shot volume out.',
        why_this_test:
          'Points are continuous, so linear regression estimates the partial association.',
      },
    ],
  };
}

function completedResponse() {
  return {
    status: 'ok',
    mode: 'plan',
    approved_execution: true,
    answer_markdown: 'Linear regression of PTS on Age and MP.',
    execution_summary: 'Exploration step 1: checked shot volume collinearity and left FGA out.',
    tool_results: [
      {
        name: 'run_analysis',
        args: {
          analysis_type: 'linear_regression',
          rationale: 'Regress points on age and minutes, leaving shot volume out.',
          why_this_test:
            'Points are continuous, so linear regression estimates the partial association.',
        },
        result: {
          ok: true,
          result: { r_squared: 0.62 },
          analysis_type: 'linear_regression',
          request_body: REQUEST_BODY,
          report: REPORT,
          why_this_test:
            'Points are continuous, so linear regression estimates the partial association.',
          rationale: 'Regress points on age and minutes, leaving shot volume out.',
        },
      },
    ],
  };
}

test('Plan Approve opens the NBA regression report', async ({ page }) => {
  await seedE2eSession(page);
  await installDatasetApiMocks(page);
  await page.route('**/assistant/agent-loop**', async route => {
    const body = route.request().postDataJSON() as {
      approved_tool_call?: unknown;
      approved_tool_calls?: unknown;
    };
    const approved = Boolean(body?.approved_tool_call || body?.approved_tool_calls);
    const response = approved ? completedResponse() : approvalResponse();
    if (route.request().url().includes('/agent-loop/stream')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify({ type: 'result', response })}\n\n`,
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });

  await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=nba_per_game_23_24.csv`);
  await expect(page.getByText('age', { exact: true }).first()).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: 'Choose Ask, Plan, or Agent mode' }).click();
  await page.getByRole('option', { name: /Plan/ }).click();

  const composer = page.getByPlaceholder('Ask about your data…');
  await composer.fill(PROMPT);
  await composer.press('Enter');
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible({ timeout: 15_000 });

  const shotDir = path.resolve(__dirname, '../../review/plan-approve');
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, 'before-approve.png'), fullPage: true });

  await page.getByRole('button', { name: 'Approve' }).click();

  const chat = page.getByTestId('agent-chat-thread');
  const card = chat.getByTestId('analysis-report-summary-card');
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText(SUMMARY);
  await expect(card).toContainText('Linear Regression');
  await expect(chat.getByText('4.12')).toHaveCount(0);
  await expect(page.getByText('4.12')).toBeVisible();

  await page.getByRole('tab', { name: 'e2e-sample.csv' }).click();
  await chat.getByTestId('analysis-report-open-tab').click();
  await expect(page.getByRole('heading', { name: 'Linear Regression' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Linear Regression/ })).toHaveAttribute(
    'aria-selected',
    'true'
  );

  await page.screenshot({ path: path.join(shotDir, 'after-summary-card.png'), fullPage: true });
});
