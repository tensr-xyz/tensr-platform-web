// Paper side-by-side for one Flow screen, on localhost:3000 only.
//
//   node design/paper/tools/compare.mjs signin
//     Signs in on /login as the Stytch sandbox user (sandbox@stytch.com, code 000000) and saves
//     the session to design/paper/tools/.auth.json. FLOW_TEST_EMAIL / FLOW_TEST_CODE override.
//
//   node design/paper/tools/compare.mjs <screen-folder> <path>
//     e.g. 6-report /flow/p/<project-id>/report
//     Screenshots the live page at 1440x900 and writes design/paper/<screen-folder>/compare.png
//     with the live screen on the left and Paper's screen.png on the right.
//     --ask "<question>" sends a chat question first and waits for the reply.
//     --anon captures signed out (the login screens).
//     --crop <selector> captures one element (for artboards that are a single panel).
//     --fill "<selector>|<text>", --click <selector>, --pick "<aria label>|<option>", --wait <selector> run in order first.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const paper = path.resolve(here, '..');
const auth = path.join(here, '.auth.json');
const base = 'http://localhost:3000';
const viewport = { width: 1440, height: 900 };

async function signin() {
  // Stytch test environment: the sandbox address always accepts code 000000.
  const email = process.env.FLOW_TEST_EMAIL || 'sandbox@stytch.com';
  const code = process.env.FLOW_TEST_CODE || '000000';
  const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${base}/login?returnTo=%2Fflow`);
  await page
    .getByPlaceholder(/email address/i)
    .first()
    .fill(email);
  await page
    .getByRole('button', { name: /^(continue|send code)$/i })
    .first()
    .click();
  await page.getByPlaceholder(/verification code/i).fill(code);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(url => url.pathname.startsWith('/flow'), { timeout: 120_000 });
  await page.waitForTimeout(3000);
  await context.storageState({ path: auth });
  await browser.close();
  console.log(`Saved ${auth} for ${email}`);
}

async function compare(folder, route, ask, steps = [], anon = false, crop = '') {
  if (!anon && !fs.existsSync(auth)) throw new Error('Run "signin" first.');
  const reference = path.join(paper, folder, 'screen.png');
  if (!fs.existsSync(reference)) throw new Error(`No ${reference}`);
  const browser = await chromium.launch();
  const context = await browser.newContext(anon ? { viewport } : { viewport, storageState: auth });
  const page = await context.newPage();
  await page.goto(`${base}${route}`, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
  // Flow pages render inside .flow once auth and the workspace are ready; /login has its own form.
  await page.waitForSelector(
    route.startsWith('/flow') ? '.flow-main' : route.startsWith('/login') ? 'form' : 'main',
    {
      timeout: 60_000,
    }
  );
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, {
    timeout: 60_000,
  });
  for (const [kind, value] of steps) {
    if (kind === '--click') {
      await page.locator(value).first().click();
    } else if (kind === '--pick') {
      const [label, option] = value.split('|');
      await page.getByLabel(label, { exact: true }).first().click();
      await page.getByRole('option', { name: option, exact: true }).first().click();
    } else if (kind === '--fill') {
      const [selector, text] = value.split('|');
      await page.locator(selector).first().fill(text);
    } else if (kind === '--wait') {
      await page.waitForSelector(value, { timeout: 120_000 });
    }
    await page.waitForTimeout(600);
  }
  if (ask) {
    await page.locator('.flow-composer textarea').first().fill(ask);
    await page.getByRole('button', { name: 'Send' }).click();
    await page.waitForSelector('.chat-result, .flow-error', { timeout: 240_000 });
  }
  // A skeleton that never clears is a finding, so capture anyway after 30s.
  await page
    .waitForFunction(() => !document.querySelector('.animate-pulse'), null, { timeout: 30_000 })
    .catch(() => console.log('A skeleton was still showing after 30s.'));
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
  // The Next.js dev badge is not part of the app.
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.waitForTimeout(500);
  const live = crop ? await page.locator(crop).first().screenshot() : await page.screenshot();
  const img = buf => `data:image/png;base64,${buf.toString('base64')}`;
  const sheet = await browser.newPage({ viewport: { width: 2 * 1440 + 24, height: 900 } });
  await sheet.setContent(
    crop
      ? `<body style="margin:0;display:flex;gap:24px;align-items:flex-start;background:#c4c3bd">
          <img src="${img(live)}"><img src="${img(fs.readFileSync(reference))}"></body>`
      : `<body style="margin:0;display:flex;gap:24px;background:#c4c3bd">
          <img src="${img(live)}" width="1440" height="900">
          <img src="${img(fs.readFileSync(reference))}" width="1440" style="height:900px;object-fit:cover;object-position:top">
        </body>`
  );
  const out = path.join(paper, folder, 'compare.png');
  await sheet.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(`Wrote ${out}`);
}

const [command, route, ...rest] = process.argv.slice(2);
const askAt = rest.indexOf('--ask');
const ask = askAt >= 0 ? rest[askAt + 1] : '';
const steps = [];
for (let index = 0; index < rest.length - 1; index += 1) {
  if (['--click', '--pick', '--wait', '--fill'].includes(rest[index]))
    steps.push([rest[index], rest[index + 1]]);
}
if (command === 'signin') await signin();
else if (command && route) {
  const cropAt = rest.indexOf('--crop');
  await compare(
    command,
    route,
    ask,
    steps,
    rest.includes('--anon'),
    cropAt >= 0 ? rest[cropAt + 1] : ''
  );
} else console.log('Usage: compare.mjs signin | compare.mjs <screen-folder> <path>');
