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
const demo = path.join(process.env.HOME || '', 'Downloads', 'tensr-market-demo');

function bearer(): string {
  const cookie = (name: string) => state.cookies?.find(c => c.name === name)?.value || '';
  return cookie('stytch_session_jwt') || cookie('stytch_session_token');
}

test.beforeEach(() => {
  test.skip(Boolean(state.skipped), state.skipped || 'Stytch test login is not configured');
  test.skip(!fs.existsSync(path.join(demo, 'cars_EN.sav')), `missing ${demo}`);
});

test('chat stacks the car markets, routes likes, and reverses France only', async ({
  page,
  request,
}) => {
  test.setTimeout(600_000);
  const auth = { Authorization: `Bearer ${bearer()}` };
  const uploaded = await request.post(`${apiBase}/api/datasets/upload?scope=personal`, {
    headers: auth,
    multipart: {
      file: {
        name: 'cars_EN.sav',
        mimeType: 'application/octet-stream',
        buffer: fs.readFileSync(path.join(demo, 'cars_EN.sav')),
      },
    },
    timeout: 60_000,
  });
  expect(uploaded.status(), await uploaded.text()).toBe(200);
  const openId = ((await uploaded.json()) as { dataset_id?: string }).dataset_id || '';
  expect(openId).toBeTruthy();
  const created: string[] = [openId];

  try {
    await page.goto(`/workspace/dataset/${openId}?name=cars_EN.sav`);
    await expect(page.getByText('Q7', { exact: true }).first()).toBeVisible({ timeout: 90_000 });

    await page.getByRole('button', { name: 'Choose Ask, Plan, or Agent mode' }).click();
    await page.getByRole('option', { name: /Agent/ }).click();
    await page
      .locator('input[type="file"][multiple]')
      .first()
      .setInputFiles([path.join(demo, 'cars_FR.sav'), path.join(demo, 'cars_DE.sav')]);
    await expect(page.getByText('cars_FR.sav').first()).toBeVisible();
    await expect(page.getByText('cars_DE.sav').first()).toBeVisible();

    const composer = page.getByPlaceholder('Ask about your data…');
    await composer.fill(
      'Stack this file with the attached cars_FR.sav and cars_DE.sav. Keep each filename’s casing as the source label.'
    );
    await composer.press('Enter');
    const approve = page.getByRole('button', { name: 'Approve' });
    await expect(approve).toBeVisible({ timeout: 120_000 });
    await approve.click();
    await expect(page).toHaveURL(new RegExp(`/workspace/dataset/(?!${openId})`), {
      timeout: 120_000,
    });
    await expect(page.getByText('cars_EN + FR + DE').first()).toBeVisible({ timeout: 60_000 });
    const stacked = page.url().match(/dataset\/([^/?]+)/)?.[1] || '';
    expect(stacked).toBeTruthy();
    expect(stacked).not.toBe(openId);
    created.push(stacked);

    await composer.fill('Scan this file for script problems.');
    await composer.press('Enter');
    await expect(page.getByText(/scale looks reversed/).first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/"eligible_if"/)).toHaveCount(0);

    await composer.fill(
      'Yes, apply those routing rules. Set the weight column as the active weight, then show likes_A by source file.'
    );
    await composer.press('Enter');
    await expect(approve).toBeVisible({ timeout: 120_000 });
    await approve.click();
    const header = page.getByText(/base .+ weighted \(unweighted .+\)/).first();
    await expect(header).toBeVisible({ timeout: 180_000 });
    await expect(header).not.toContainText('unweighted 900');
    await expect(page.getByText(/should not be trusted/)).toHaveCount(0);

    await composer.fill(
      'Reverse Q7 for cars_FR only (1 to 5, 2 to 4, 4 to 2, 5 to 1), then rerun the Q7 by source file table.'
    );
    await composer.press('Enter');
    await expect(page.getByText(/for cars_FR only/).first()).toBeVisible({ timeout: 120_000 });
    await expect(approve).toBeVisible();
    await approve.click();
    await expect(page.getByText(/Q7/).first()).toBeVisible({ timeout: 180_000 });
    await expect(page.getByText(/should not be trusted/)).toHaveCount(0);
  } finally {
    for (const id of created) {
      await request.delete(`${apiBase}/api/datasets/${id}`, {
        headers: auth,
        failOnStatusCode: false,
      });
    }
  }
});
