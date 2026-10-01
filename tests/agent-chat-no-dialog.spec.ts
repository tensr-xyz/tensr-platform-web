import { test, expect } from '@playwright/test';
import { E2E_DATASET_ID, seedE2eSession } from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

test.describe('Chat stays in chat (no dialog steal)', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSession(page);
    await installDatasetApiMocks(page);
    const agentResponse = {
      status: 'ok',
      mode: 'agent',
      answer_markdown: 'Ran ANOVA in chat. No setup dialog.',
      tool_results: [
        {
          name: 'run_analysis',
          args: { analysis_type: 'anova_oneway' },
          result: { ok: true, analysis_type: 'anova_oneway' },
        },
      ],
    };
    await page.route('**/assistant/agent-loop**', async route => {
      if (route.request().url().includes('/agent-loop/stream')) {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({ type: 'result', response: agentResponse })}\n\n`,
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(agentResponse),
      });
    });
    await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
    await expect(page.getByText('age', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  });

  test('ANOVA and crosstab prompts never open an analysis setup dialog', async ({ page }) => {
    const composer = page.getByPlaceholder('Ask about your data…');
    await expect(composer).toBeVisible();

    await composer.fill('run anova on Age and Pos');
    await composer.press('Enter');
    await expect(page.getByText('Ran ANOVA in chat')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Run analysis' })).toHaveCount(0);

    await composer.fill('Cross tab Pos by Age');
    await composer.press('Enter');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Run analysis' })).toHaveCount(0);
  });
});
