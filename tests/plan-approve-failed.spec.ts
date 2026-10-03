import { expect, test, type Page } from '@playwright/test';
import { E2E_DATASET_ID, seedE2eSession } from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

const PROMPT = 'what predicts points independent of shot volume';
const PLAN = 'Regress points on age and minutes, leaving shot volume out.';
const WHY = 'Points are continuous, so linear regression estimates the partial association.';

function approvalResponse() {
  return {
    status: 'awaiting_approval',
    mode: 'plan',
    answer_markdown: `**Plan:** ${PLAN}\n\n**Why this test:** ${WHY}`,
    pending_approvals: [
      {
        tool_call_id: 'call_nba_pts',
        name: 'run_analysis',
        args: {
          analysis_type: 'linear_regression',
          rationale: PLAN,
          why_this_test: WHY,
          request_body: { dependent: 'PTS', independents: ['Age', 'MP'] },
        },
        rationale: PLAN,
        why_this_test: WHY,
      },
    ],
  };
}

type ApprovedReply = { status: number; body: unknown };

async function planThenApprove(page: Page, approved: ApprovedReply) {
  await seedE2eSession(page);
  await installDatasetApiMocks(page);
  await page.route('**/assistant/agent-loop**', async route => {
    const body = route.request().postDataJSON() as {
      approved_tool_call?: unknown;
      approved_tool_calls?: unknown;
    };
    const isApprove = Boolean(body?.approved_tool_call || body?.approved_tool_calls);
    const stream = route.request().url().includes('/agent-loop/stream');
    if (isApprove && approved.status !== 200) {
      await route.fulfill({
        status: approved.status,
        contentType: 'application/json',
        body: JSON.stringify(approved.body),
      });
      return;
    }
    const response = isApprove ? approved.body : approvalResponse();
    await route.fulfill(
      stream
        ? {
            status: 200,
            contentType: 'text/event-stream',
            body: `data: ${JSON.stringify({ type: 'result', response })}\n\n`,
          }
        : { status: 200, contentType: 'application/json', body: JSON.stringify(response) }
    );
  });

  await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=nba_per_game_23_24.csv`);
  await expect(page.getByText('age', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Choose Ask, Plan, or Agent mode' }).click();
  await page.getByRole('option', { name: /Plan/ }).click();
  const composer = page.getByPlaceholder('Ask about your data…');
  await composer.fill(PROMPT);
  await composer.press('Enter');
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Approve' }).click();
}

async function expectPlanKeptAndRunFailed(page: Page, errorText: string) {
  const chat = page.getByTestId('agent-chat-thread');
  await expect(chat.getByText('Run failed')).toBeVisible({ timeout: 15_000 });
  await expect(chat.getByText('Awaiting approval')).toHaveCount(0);
  await expect(chat.getByText(PLAN).first()).toBeVisible();
  await expect(chat.getByText(WHY).first()).toBeVisible();
  // Once on the card. A second copy means the message body was overwritten.
  await expect(chat.getByText(errorText)).toHaveCount(1);
  await expect(chat.getByText('**')).toHaveCount(0);
}

test('A thrown approve error keeps the Plan text and labels the card Run failed', async ({
  page,
}) => {
  await planThenApprove(page, {
    status: 500,
    body: { detail: 'Regression failed: PTS has no variance.' },
  });
  await expectPlanKeptAndRunFailed(page, 'Regression failed: PTS has no variance.');
});

test('An error status on approve keeps the Plan text and the card', async ({ page }) => {
  await planThenApprove(page, {
    status: 200,
    body: {
      status: 'error',
      mode: 'plan',
      answer_markdown: 'The datasets service could not run this regression.',
    },
  });
  await expectPlanKeptAndRunFailed(page, 'The datasets service could not run this regression.');
});

test('A pipeline that halts on a step keeps the Plan text and the card', async ({ page }) => {
  const halted =
    'Step 3 of 5 (merge_datasets) failed: secondary_dataset_id is required for merge_datasets.';
  await planThenApprove(page, {
    status: 200,
    body: {
      status: 'clarification',
      mode: 'plan',
      answer_markdown: halted,
      clarification_questions: [halted],
      pipeline_halted: true,
      failed_step_index: 2,
      approved_execution: true,
      reapprove_pipeline: false,
    },
  });
  await expectPlanKeptAndRunFailed(page, halted);
});
