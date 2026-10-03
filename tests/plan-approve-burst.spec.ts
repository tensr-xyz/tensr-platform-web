import { expect, test } from '@playwright/test';
import { E2E_DATASET_ID, seedE2eSession } from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

const SUMMARY = 'Weighted to the ESS targets; 5 respondents with missing categories get weight 0.';
const STEPS = 35;

const approval = {
  status: 'awaiting_approval',
  mode: 'plan',
  answer_markdown: '**Plan:** Merge the profile onto the survey, then rake to the targets.',
  pending_approvals: [
    {
      tool_call_id: 'call_rake',
      name: 'run_analysis',
      args: {
        analysis_type: 'linear_regression',
        rationale: 'Merge the profile onto the survey, then rake to the targets.',
        request_body: { dependent: 'PTS', independents: ['Age'] },
      },
      rationale: 'Merge the profile onto the survey, then rake to the targets.',
    },
  ],
};

const completed = {
  status: 'ok',
  mode: 'plan',
  approved_execution: true,
  answer_markdown: 'Raked to the ESS targets.',
  tool_results: [
    {
      name: 'run_analysis',
      args: { analysis_type: 'linear_regression' },
      result: {
        ok: true,
        result: { r_squared: 0.5 },
        analysis_type: 'linear_regression',
        report: {
          meta: { analysis_key: 'linear_regression', title: 'Linear Regression' },
          summary: SUMMARY,
          metrics: [],
          tables: [],
          trust: { notes: [], warnings: [] },
        },
      },
    },
  ],
};

function burst(): string {
  const progress = Array.from({ length: STEPS }, (_, i) =>
    JSON.stringify({
      type: 'tool_start',
      step: 'tool',
      message: `Running run analysis (${i + 1}/${STEPS})…`,
    })
  );
  return [...progress, JSON.stringify({ type: 'result', response: completed })]
    .map(line => `data: ${line}\n\n`)
    .join('');
}

test('a buffered approve stream renders the result as soon as it arrives', async ({ page }) => {
  await seedE2eSession(page);
  await installDatasetApiMocks(page);
  await page.route('**/assistant/agent-loop**', async route => {
    const body = route.request().postDataJSON() as {
      approved_tool_call?: unknown;
      approved_tool_calls?: unknown;
    };
    const approved = Boolean(body?.approved_tool_call || body?.approved_tool_calls);
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: approved
        ? burst()
        : `data: ${JSON.stringify({ type: 'result', response: approval })}\n\n`,
    });
  });

  await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=qualtrics_wave1.csv`);
  await expect(page.getByText('age', { exact: true }).first()).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: 'Choose Ask, Plan, or Agent mode' }).click();
  await page.getByRole('option', { name: /Plan/ }).click();
  const composer = page.getByPlaceholder('Ask about your data…');
  await composer.fill('merge the profile and weight to the targets');
  await composer.press('Enter');
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible({ timeout: 15_000 });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

  const responded = page.waitForResponse(
    r => r.url().includes('/agent-loop/stream') && r.request().postData()?.includes('approved')
  );
  await page.getByRole('button', { name: 'Approve' }).click();
  await responded;
  const arrivedAt = Date.now();

  const chat = page.getByTestId('agent-chat-thread');
  await expect(chat.getByText('Raked to the ESS targets.')).toBeVisible({ timeout: 1_000 });
  await expect(chat.getByText('Working', { exact: false })).toHaveCount(0, { timeout: 1_000 });
  const renderMs = Date.now() - arrivedAt;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  test.info().annotations.push({ type: 'render_ms', description: String(renderMs) });
});
