import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const cars = 'bcb04183-3e60-4bcd-9d0c-7b7dbbf01390';
const tabs = [
  ['chat', '.chat-hero-copy, .chat-stage h1, .chat-scroll'],
  ['details', '.details-explainer'],
  ['sources', '.sources-head'],
  ['responses', '.sheet-frame table'],
  ['tables', '.tables-rail-head'],
  ['report', '.report-page, .outputs-board, .report-empty'],
];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: path.join(here, '.auth.json'),
});
const page = await context.newPage();
const slow = [];
page.on('requestfinished', req => {
  const ms = req.timing().responseEnd;
  if (ms > 700 && req.url().includes('/api/tensr/'))
    slow.push(`${Math.round(ms)}ms ${req.url().split('/api/tensr/')[1].slice(0, 80)}`);
});
const out = {};
const t0 = Date.now();
await page.goto(`http://localhost:3000/flow/p/${cars}/chat`, { waitUntil: 'commit' });
await page.waitForSelector(tabs[0][1], { timeout: 90000 });
out.firstLoadChat = Date.now() - t0;
for (const round of [1, 2]) {
  for (const [tab, sel] of tabs) {
    if (tab === 'chat' && round === 1) continue;
    const t1 = Date.now();
    await page.locator('.proj-tabs a', { hasText: new RegExp(`^${tab}$`, 'i') }).click();
    await page.waitForURL(`**/${tab}`, { timeout: 30000 });
    await page.waitForSelector(sel, { timeout: 60000 }).catch(() => null);
    await page
      .waitForFunction(() => !document.querySelector('.flow-body [aria-busy="true"]'), null, {
        timeout: 60000,
      })
      .catch(() => null);
    out[`${tab}${round}`] = Date.now() - t1;
  }
}
out.slow = slow.slice(-14);
console.log(JSON.stringify(out));
await browser.close();
