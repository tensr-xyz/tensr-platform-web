import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type StoredState = {
  cookies?: { name: string; value: string }[];
  skipped?: string;
};

const statePath = path.join(__dirname, '.auth', 'state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as StoredState;
const apiBase =
  process.env.PLAYWRIGHT_LIVE_API_URL || 'https://5qv9lg3s55.execute-api.us-east-1.amazonaws.com';

// group a holds scores 1, 3, 5, 7; mean(a) = 4. Editing score 1 to 1000 makes it 253.75.
const CSV = 'group,score\na,1\nb,2\na,3\nb,4\na,5\nb,6\na,7\nb,8\n';

function auth() {
  const cookie = (name: string) => state.cookies?.find(c => c.name === name)?.value || '';
  return {
    Authorization: `Bearer ${cookie('stytch_session_jwt') || cookie('stytch_session_token')}`,
  };
}

async function upload(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post(`${apiBase}/api/datasets/upload?scope=personal`, {
    headers: auth(),
    multipart: { file: { name, mimeType: 'text/csv', buffer: Buffer.from(CSV) } },
    timeout: 60_000,
  });
  expect(res.status(), await res.text()).toBe(200);
  const id = ((await res.json()) as { dataset_id?: string }).dataset_id || '';
  expect(id).toBeTruthy();
  return id;
}

async function scores(request: APIRequestContext, datasetId: string): Promise<unknown[]> {
  const res = await request.get(
    `${apiBase}/api/datasets/${datasetId}/preview?limit=10&show_value_labels=false`,
    { headers: auth() }
  );
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { variable_names: string[]; rows: unknown[] };
  const i = body.variable_names.indexOf('score');
  return body.rows.map(row =>
    Array.isArray(row) ? row[i] : (row as Record<string, unknown>).score
  );
}

async function meanOfGroupA(request: APIRequestContext, datasetId: string): Promise<number[]> {
  const runs = await Promise.all(
    Array.from({ length: 6 }, () =>
      request.post(`${apiBase}/api/datasets/${datasetId}/analyze/ttest_independent`, {
        headers: auth(),
        data: { group_column: 'group', value_column: 'score' },
        timeout: 60_000,
      })
    )
  );
  return Promise.all(
    runs.map(async r => {
      expect(r.status()).toBe(200);
      const result = (
        (await r.json()) as { result: { group_names: string[]; group_means: number[] } }
      ).result;
      return result.group_means[result.group_names.indexOf('a')];
    })
  );
}

/** Records the session sheet's websocket traffic so steps can wait on the server. */
function watchSheet(page: Page) {
  const frames: string[] = [];
  const sent: string[] = [];
  page.on('websocket', ws => {
    ws.on('framereceived', f => {
      if (typeof f.payload === 'string' && f.payload.includes('"sheetId": "session:'))
        frames.push(f.payload);
    });
    ws.on('framesent', f => {
      if (typeof f.payload === 'string' && f.payload.includes('"type":"op"')) sent.push(f.payload);
    });
  });
  return {
    async waitFor(pattern: RegExp, timeout = 60_000) {
      await expect.poll(() => frames.some(f => pattern.test(f)), { timeout }).toBe(true);
    },
    sentOp(newValue: string) {
      return sent.some(f => f.includes(`"newValue":"${newValue}"`));
    },
  };
}

async function openCollaboration(page: Page) {
  await page.getByRole('button', { name: /Start collaboration|Collaboration session/ }).click();
}

type Sheet = ReturnType<typeof watchSheet>;

/**
 * An edit made before the shared copy has loaded is refused with a toast and the cell
 * shows the stored value again; retry until the op is actually sent.
 */
async function editScore(page: Page, sheet: Sheet, from: string, to: string) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await page.keyboard.press('Escape');
    const cell = page
      .locator('[data-column-id="score"]')
      .filter({ hasText: new RegExp(`^${from}$`) })
      .first();
    await cell.dblclick();
    const editor = page.locator('input:focus, textarea:focus').first();
    await editor.waitFor({ timeout: 10_000 });
    await editor.fill(to);
    await page.keyboard.press('Enter');
    const refused = page.getByText('The shared copy is still loading', { exact: false });
    await expect
      .poll(async () => sheet.sentOp(to) || (await refused.count()) > 0, { timeout: 10_000 })
      .toBe(true);
    if (sheet.sentOp(to)) return;
    await expect(
      page
        .locator('[data-column-id="score"]')
        .filter({ hasText: new RegExp(`^${from}$`) })
        .first()
    ).toBeVisible();
    await page.waitForTimeout(2_000);
  }
  throw new Error(`edit ${from} -> ${to} was never sent`);
}

async function startSession(page: Page, datasetId: string, name: string) {
  const sheet = watchSheet(page);
  await page.goto(`/workspace/dataset/${datasetId}?name=${name}`);
  await expect(page.getByTestId('column-menu-score')).toBeVisible({ timeout: 90_000 });
  await openCollaboration(page);
  await page.getByRole('button', { name: 'Start Session' }).click();
  await expect(page.getByRole('button', { name: 'Save Back to Dataset' })).toBeVisible({
    timeout: 60_000,
  });
  await sheet.waitFor(/"type": "initial_state"/);
  await page.keyboard.press('Escape');
  return sheet;
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
}

test.beforeEach(() => {
  test.skip(Boolean(state.skipped), state.skipped || 'Stytch test login is not configured');
});

test('a session edit saves back, survives a reload, and every analysis sees it', async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const name = `collab_save_${Date.now()}.csv`;
  const datasetId = await upload(request, name);
  try {
    expect(await meanOfGroupA(request, datasetId)).toEqual(Array(6).fill(4));
    const sheet = await startSession(page, datasetId, name);

    await editScore(page, sheet, '1', '1000');
    await sheet.waitFor(/"type": "op_applied".*"newValue": "1000"/);
    await shot(page, '1-edited-in-session');

    await openCollaboration(page);
    const saved = page.waitForResponse(
      r => r.url().includes('/save-back') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Save Back to Dataset' }).click();
    expect((await saved).status()).toBe(200);

    await page.reload();
    await expect(
      page
        .locator('[data-column-id="score"]')
        .filter({ hasText: /^1000$/ })
        .first()
    ).toBeVisible({ timeout: 90_000 });
    await shot(page, '2-after-save-back-and-reload');

    expect(await scores(request, datasetId)).toEqual([1000, 2, 3, 4, 5, 6, 7, 8]);
    expect(await meanOfGroupA(request, datasetId)).toEqual(Array(6).fill(253.75));
  } finally {
    await request.delete(`${apiBase}/api/datasets/${datasetId}`, {
      headers: auth(),
      failOnStatusCode: false,
    });
  }
});

test('discarding a session leaves the source dataset unchanged', async ({ page, request }) => {
  test.setTimeout(240_000);
  const name = `collab_discard_${Date.now()}.csv`;
  const datasetId = await upload(request, name);
  try {
    const sheet = await startSession(page, datasetId, name);
    await editScore(page, sheet, '1', '1000');
    await sheet.waitFor(/"type": "op_applied".*"newValue": "1000"/);

    await openCollaboration(page);
    const discarded = page.waitForResponse(
      r => r.url().includes('/discard') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Discard Session' }).click();
    expect((await discarded).status()).toBe(200);

    await page.reload();
    await expect(page.getByTestId('column-menu-score')).toBeVisible({ timeout: 90_000 });
    await expect(
      page.locator('[data-column-id="score"]').filter({ hasText: /^1000$/ })
    ).toHaveCount(0);
    await shot(page, '3-after-discard-and-reload');
    expect(await scores(request, datasetId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  } finally {
    await request.delete(`${apiBase}/api/datasets/${datasetId}`, {
      headers: auth(),
      failOnStatusCode: false,
    });
  }
});

test('two clients editing different cells both reach the saved dataset', async ({
  browser,
  page,
  request,
}) => {
  test.setTimeout(300_000);
  const name = `collab_two_${Date.now()}.csv`;
  const datasetId = await upload(request, name);
  const second = await browser.newContext({ storageState: statePath });
  try {
    const hostSheet = await startSession(page, datasetId, name);
    const sessionId = new URL(page.url()).searchParams.get('session');
    expect(sessionId).toBeTruthy();

    const guest = await second.newPage();
    const guestSheet = watchSheet(guest);
    await guest.goto(
      `/workspace/collaborate?session=${sessionId}&datasetId=${datasetId}&name=${name}`
    );
    await expect(guest.getByTestId('column-menu-score')).toBeVisible({ timeout: 90_000 });
    await guestSheet.waitFor(/"type": "initial_state"/);

    await Promise.all([
      editScore(page, hostSheet, '1', '100'),
      editScore(guest, guestSheet, '8', '800'),
    ]);
    await hostSheet.waitFor(/"type": "op_applied".*"newValue": "800"/);
    await guestSheet.waitFor(/"type": "op_applied".*"newValue": "100"/);
    await expect(
      guest.locator('[data-column-id="score"]').filter({ hasText: /^100$/ }).first()
    ).toBeVisible();
    await expect(
      page.locator('[data-column-id="score"]').filter({ hasText: /^800$/ }).first()
    ).toBeVisible();
    await shot(page, '4-host-sees-both-edits');
    await shot(guest, '5-guest-sees-both-edits');

    await openCollaboration(page);
    const saved = page.waitForResponse(
      r => r.url().includes('/save-back') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Save Back to Dataset' }).click();
    expect((await saved).status()).toBe(200);

    expect(await scores(request, datasetId)).toEqual([100, 2, 3, 4, 5, 6, 7, 800]);
  } finally {
    await second.close();
    await request.delete(`${apiBase}/api/datasets/${datasetId}`, {
      headers: auth(),
      failOnStatusCode: false,
    });
  }
});
