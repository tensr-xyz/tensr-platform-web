// Signed-in probe for QA: node design/paper/tools/probe.mjs <path> <script.js> [--shot out.png]
// The script file is evaluated in the page and its return value printed as JSON.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , target, scriptPath, ...rest] = process.argv;
const shot = rest.includes('--shot') ? rest[rest.indexOf('--shot') + 1] : null;
const wait = rest.includes('--wait') ? rest[rest.indexOf('--wait') + 1] : null;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: path.join(here, '.auth.json'),
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', err => errors.push(String(err)));
await page.goto(`http://localhost:3000${target}`, { waitUntil: 'networkidle', timeout: 90000 });
if (wait)
  await page.waitForSelector(wait, { timeout: 60000 }).catch(() => errors.push(`no ${wait}`));
await page.waitForTimeout(1500);
if (scriptPath) {
  const body = fs.readFileSync(scriptPath, 'utf8');
  const out = await page.evaluate(`(async () => { ${body} })()`);
  console.log(JSON.stringify(out, null, 1));
}
if (shot) await page.screenshot({ path: shot });
if (errors.length) console.log('PAGE ERRORS', errors);
await browser.close();
