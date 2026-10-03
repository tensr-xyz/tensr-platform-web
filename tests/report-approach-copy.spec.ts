import { expect, test } from '@playwright/test';
import { E2E_DATASET_ID, seedE2eSession } from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

const PLAN = 'Running linear regression predicting **PTS** from Age and MP.';
const REPEATED_ALTERNATIVE = 'Regress PTS on Age and MP, leaving the controlled factor out.';
const WHY = 'Points are continuous, so linear regression estimates the partial association.';
const NARRATIVE =
  '1. Linear Regression of `PTS` on `Age` and `MP`. The model explains 62% of the variation in `PTS`.\n' +
  '2. Follow-up check: Correlation of `PTS`, `Age` and `MP`. The strongest pair is `PTS` and `MP`.';
const TRACE =
  'Step 1: `run_analysis` | type=linear_regression | role=primary | ok\n' +
  '  rejected_alternative: Regress PTS on Age, MP.\n' +
  '  prior_result_id: call_nba_pts';
const REQUEST_BODY = { dependent: 'PTS', independents: ['Age', 'MP'] };

const REPORT = {
  meta: {
    analysis_key: 'linear_regression',
    title: 'Linear Regression',
    subtitle: 'PTS ~ Age + MP',
    generated_at: '2026-10-03T00:00:00Z',
    rows_dataset: 572,
  },
  summary: 'Age and minutes predict points per game (R² = 0.62, n = 572).',
  metrics: [{ label: 'R²', value: '0.620', emphasis: true }],
  tables: [],
  trust: { notes: [], warnings: [] },
};

const ARGS = {
  analysis_type: 'linear_regression',
  rationale: PLAN,
  why_this_test: WHY,
  rejected_alternative: REPEATED_ALTERNATIVE,
  request_body: REQUEST_BODY,
};

function approvalResponse() {
  return {
    status: 'awaiting_approval',
    mode: 'plan',
    answer_markdown: `**Plan:** ${PLAN}`,
    pending_approvals: [
      {
        tool_call_id: 'call_nba_pts',
        name: 'run_analysis',
        args: ARGS,
        rationale: PLAN,
        why_this_test: WHY,
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
    execution_summary: NARRATIVE,
    execution_trace: TRACE,
    tool_results: [
      {
        name: 'run_analysis',
        args: ARGS,
        result: {
          ok: true,
          result: { r_squared: 0.62 },
          analysis_type: 'linear_regression',
          request_body: REQUEST_BODY,
          report: REPORT,
          why_this_test: WHY,
          rationale: PLAN,
        },
      },
    ],
  };
}

test('Report Approach reads as English and keeps the tool trace behind Show technical details', async ({
  page,
}) => {
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
  await composer.fill('what predicts points independent of shot volume');
  await composer.press('Enter');
  await page.getByRole('button', { name: 'Approve' }).click({ timeout: 15_000 });

  const chat = page.getByTestId('agent-chat-thread');
  await expect(chat.getByTestId('analysis-report-summary-card')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('tab', { name: 'e2e-sample.csv' }).click();
  await chat.getByTestId('analysis-report-open-tab').click();

  const approach = page.locator('#report-section-approach');
  await expect(approach).toBeVisible();
  await expect(approach.locator('strong', { hasText: 'PTS' }).first()).toBeVisible();
  await expect(approach.getByText('The model explains 62% of the variation')).toBeVisible();
  await expect(approach.getByText('Considered alternative')).toHaveCount(0);

  const details = page.getByTestId('report-technical-details');
  await expect(details).toBeVisible();
  await expect(details.getByText('role=primary')).toBeHidden();
  const visibleApproach = await approach.evaluate(el => (el as HTMLElement).innerText);
  expect(visibleApproach).not.toContain('**');
  expect(visibleApproach).not.toMatch(/role=|call_nba_pts|rejected_alternative/);

  await details.getByText('Show technical details').click();
  await expect(details.getByText(/role=primary/)).toBeVisible();
});
