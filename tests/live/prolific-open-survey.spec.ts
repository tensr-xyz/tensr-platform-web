import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type StoredState = {
  cookies?: { name: string; value: string }[];
  skipped?: string;
};

const state = JSON.parse(
  fs.readFileSync(path.join(__dirname, '.auth', 'state.json'), 'utf8')
) as StoredState;

const apiBase =
  process.env.PLAYWRIGHT_LIVE_API_URL || 'https://5qv9lg3s55.execute-api.us-east-1.amazonaws.com';
const fixtures = path.join(__dirname, 'fixtures');
const MESSAGE =
  'merge these on participant_id and weight to these targets, exclude missing categories';

function bearer(): string {
  const cookie = (name: string) => state.cookies?.find(c => c.name === name)?.value || '';
  return cookie('stytch_session_jwt') || cookie('stytch_session_token');
}

test.beforeEach(() => {
  test.skip(Boolean(state.skipped), state.skipped || 'Stytch test login is not configured');
});

test('Prolific approve merges the attached profile onto the open survey', async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const auth = { Authorization: `Bearer ${bearer()}` };
  const uploaded = await request.post(`${apiBase}/api/datasets/upload?scope=personal`, {
    headers: auth,
    multipart: {
      file: {
        name: 'qualtrics_wave1.csv',
        mimeType: 'text/csv',
        buffer: fs.readFileSync(path.join(fixtures, 'qualtrics_wave1.csv')),
      },
    },
    timeout: 60_000,
  });
  expect(uploaded.status(), await uploaded.text()).toBe(200);
  const surveyId = ((await uploaded.json()) as { dataset_id?: string }).dataset_id || '';
  expect(surveyId).toBeTruthy();

  try {
    await page.goto(`/workspace/dataset/${surveyId}?name=qualtrics_wave1.csv`);
    await expect(page.getByText('participant_id', { exact: true }).first()).toBeVisible({
      timeout: 90_000,
    });

    await page.getByRole('button', { name: 'Choose Ask, Plan, or Agent mode' }).click();
    await page.getByRole('option', { name: /Plan/ }).click();

    await page
      .locator('input[type="file"][multiple]')
      .first()
      .setInputFiles([
        path.join(fixtures, 'prolific_profile.csv'),
        path.join(fixtures, 'targets.csv'),
      ]);
    await expect(page.getByText('prolific_profile.csv').first()).toBeVisible();
    await expect(page.getByText('targets.csv').first()).toBeVisible();

    const composer = page.getByPlaceholder('Ask about your data…');
    await composer.fill(MESSAGE);
    await composer.press('Enter');

    const approve = page.getByRole('button', { name: 'Approve' });
    await expect(approve).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText(/Attach the survey/)).toHaveCount(0);
    await approve.click();

    await expect(page.getByText(/ESS/).first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/secondary_dataset_id/)).toHaveCount(0);
    await expect(page.getByText('Run failed')).toHaveCount(0);
  } finally {
    await request.delete(`${apiBase}/api/datasets/${surveyId}`, {
      headers: auth,
      failOnStatusCode: false,
    });
  }
});
