// Paper side-by-side for one Flow screen, on localhost:3000 only.
//
//   node design/paper/tools/compare.mjs signin
//     Opens Chromium on /login. Sign in; the session is saved to design/paper/tools/.auth.json.
//
//   node design/paper/tools/compare.mjs <screen-folder> <path>
//     e.g. 6-report /flow/p/<project-id>/report
//     Screenshots the live page at 1440x900 and writes design/paper/<screen-folder>/compare.png
//     with the live screen on the left and Paper's screen.png on the right.
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
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${base}/login?returnTo=%2Fflow`);
  await page.waitForURL(url => url.pathname.startsWith('/flow'), { timeout: 30 * 60 * 1000 });
  await page.waitForTimeout(3000);
  await context.storageState({ path: auth });
  await browser.close();
  console.log(`Saved ${auth}`);
}

async function compare(folder, route) {
  if (!fs.existsSync(auth)) throw new Error('Run "signin" first.');
  const reference = path.join(paper, folder, 'screen.png');
  if (!fs.existsSync(reference)) throw new Error(`No ${reference}`);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport, storageState: auth });
  const page = await context.newPage();
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, {
    timeout: 60_000,
  });
  await page.waitForTimeout(500);
  const live = await page.screenshot();
  const sheet = await browser.newPage({ viewport: { width: 2 * 1440 + 24, height: 900 } });
  const img = buf => `data:image/png;base64,${buf.toString('base64')}`;
  await sheet.setContent(`
    <body style="margin:0;display:flex;gap:24px;background:#c4c3bd">
      <img src="${img(live)}" width="1440" height="900">
      <img src="${img(fs.readFileSync(reference))}" width="1440" style="height:900px;object-fit:cover;object-position:top">
    </body>`);
  const out = path.join(paper, folder, 'compare.png');
  await sheet.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(`Wrote ${out}`);
}

const [command, route] = process.argv.slice(2);
if (command === 'signin') await signin();
else if (command && route) await compare(command, route);
else console.log('Usage: compare.mjs signin | compare.mjs <screen-folder> <path>');
