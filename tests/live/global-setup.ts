import { chromium, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const statePath = path.join(__dirname, '.auth', 'state.json');

/**
 * Signs in a Stytch test-environment user and saves storageState.
 * Required env: STYTCH_TEST_EMAIL, and either a password or a one-time code
 * the operator pastes as STYTCH_TEST_OTP. Without those, the live suite skips.
 */
export default async function globalSetup(config: FullConfig) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const email = process.env.STYTCH_TEST_EMAIL?.trim();
  const password = process.env.STYTCH_TEST_PASSWORD?.trim();
  const otp = process.env.STYTCH_TEST_OTP?.trim();
  if (!email || (!password && !otp)) {
    fs.writeFileSync(
      statePath,
      JSON.stringify({
        cookies: [],
        origins: [],
        skipped: 'missing STYTCH_TEST_EMAIL and STYTCH_TEST_PASSWORD or STYTCH_TEST_OTP',
      })
    );
    return;
  }

  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) throw new Error('playwright.live.config.ts needs a baseURL');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /^continue$/i }).click();
  if (otp) {
    const boxes = page.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]');
    if (await boxes.count()) {
      await boxes.first().fill(otp);
    } else {
      await page.keyboard.type(otp);
    }
  }
  await page.waitForURL(/\/(dashboard|workspace)/, { timeout: 60_000 });
  await page.context().storageState({ path: statePath });
  await browser.close();
}
