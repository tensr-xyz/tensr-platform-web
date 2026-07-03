import type { Page } from '@playwright/test';

/** JWT with exp far in the future (API bearer + client storage; proxy uses session token only). */
export const E2E_SESSION_JWT =
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJleHAiOjQxMDI0NDQ4MDAsInN1YiI6ImUyZS11c2VyIn0.';

export const E2E_DATASET_ID = 'e2e00000-0000-4000-8000-000000000001';

export async function seedE2eSession(page: Page): Promise<void> {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  await page.context().addCookies([
    {
      name: 'stytch_session_token',
      value: 'e2e-playwright-session',
      url: baseUrl,
    },
    {
      name: 'stytch_session_jwt',
      value: E2E_SESSION_JWT,
      url: baseUrl,
    },
  ]);

  await page.addInitScript(
    ({ jwt }) => {
      localStorage.setItem('stytch_session_token', 'e2e-playwright-session');
      localStorage.setItem('stytch_session_jwt', jwt);
      const persisted = {
        state: {
          user: { userId: 'e2e-user', email: 'e2e@playwright.test' },
        },
        version: 0,
      };
      localStorage.setItem('auth-store', JSON.stringify(persisted));
    },
    { jwt: E2E_SESSION_JWT }
  );
}

export function analysisPalette(page: Page) {
  return page
    .getByRole('dialog')
    .filter({ has: page.getByPlaceholder('Search analyses and plugins…') });
}

export async function openAnalysisPalette(page: Page): Promise<void> {
  const isMac = process.platform === 'darwin';
  await page.keyboard.press(isMac ? 'Meta+k' : 'Control+k');
  await analysisPalette(page).waitFor();
}

export async function selectPaletteTab(
  page: Page,
  tabName: 'Data' | 'Analyze' | 'Transform' | 'Charts' | 'ML & AI' | 'Plugins'
): Promise<void> {
  const palette = analysisPalette(page);
  await palette.getByRole('tab', { name: tabName }).click();
}

export async function dismissDialogs(page: Page): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    const dialogs = page.getByRole('dialog');
    if ((await dialogs.count()) === 0) return;
    await page.keyboard.press('Escape');
  }
}
