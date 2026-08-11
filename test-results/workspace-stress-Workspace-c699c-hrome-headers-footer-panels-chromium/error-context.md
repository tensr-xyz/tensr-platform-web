# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workspace-stress.spec.ts >> Workspace stress — shell & navigation >> loads sheet chrome: headers, footer, panels
- Location: tests/workspace-stress.spec.ts:36:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('age', { exact: true }).first()
Expected: visible
Timeout: 60000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 60000ms
  - waiting for getByText('age', { exact: true }).first()
    6 × waiting for" http://localhost:3000/login?returnTo=%2Fworkspace%2Fdataset%2Fe2e00000-0000-4000-8000-000000000001%3Fname%3De2e-sample.csv" navigation to finish...
      - navigated to "http://localhost:3000/login?returnTo=%2Fworkspace%2Fdataset%2Fe2e00000-0000-4000-8000-000000000001%3Fname%3De2e-sample.csv"

```

```yaml
- img "Tensr Logo"
- text: Welcome to Tensr The new way to analyse data
- button "Continue with Google" [disabled]:
    - img
    - text: Continue with Google
- button "Continue with GitHub" [disabled]:
    - img
    - text: Continue with GitHub
- text: OR Email
- textbox "Email" [disabled]:
    - /placeholder: Your email address
- button "Sending..." [disabled]
- link "Terms of Service":
    - /url: https://tensr-1.gitbook.io/tensr/legal-policies/terms-of-service
- text: and
- link "Privacy Policy":
    - /url: https://tensr-1.gitbook.io/tensr/legal-policies/privacy-policy
- region "Notifications (F8)":
    - list
- alert
```

# Test source

```ts
  1   | /**
  2   |  * Workspace stress suite — covers sheet chrome + table interactions.
  3   |  *
  4   |  * Run:
  5   |  *   pnpm test:workspace
  6   |  *   pnpm exec playwright test -c playwright.workspace.config.ts --headed
  7   |  *
  8   |  * Inventory covered here (automate first wave). Remaining manual / later waves
  9   |  * are listed at the bottom of this file.
  10  |  */
  11  | import { test, expect, type Page, type Locator } from '@playwright/test';
  12  | import { E2E_DATASET_ID, seedE2eSession } from './fixtures/e2e-auth';
  13  | import { installDatasetApiMocks } from './fixtures/api-mocks';
  14  |
  15  | async function openDatasetWorkspace(page: Page): Promise<void> {
  16  |   await seedE2eSession(page);
  17  |   await installDatasetApiMocks(page);
  18  |   await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
> 19  |   await expect(page.getByText('age', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
      |                                                                ^ Error: expect(locator).toBeVisible() failed
  20  | }
  21  |
  22  | function sheetHeaderButton(page: Page, columnName: string): Locator {
  23  |   return page.getByRole('button', { name: columnName, exact: true }).first();
  24  | }
  25  |
  26  | async function openColumnMenu(page: Page, columnName: string): Promise<void> {
  27  |   await sheetHeaderButton(page, columnName).click();
  28  |   await expect(page.getByRole('menuitem', { name: /Sort ascending/i })).toBeVisible();
  29  | }
  30  |
  31  | test.describe('Workspace stress — shell & navigation', () => {
  32  |   test.beforeEach(async ({ page }) => {
  33  |     await openDatasetWorkspace(page);
  34  |   });
  35  |
  36  |   test('loads sheet chrome: headers, footer, panels', async ({ page }) => {
  37  |     await expect(page.getByText('age', { exact: true }).first()).toBeVisible();
  38  |     await expect(page.getByText('group', { exact: true }).first()).toBeVisible();
  39  |     await expect(page.getByText('score', { exact: true }).first()).toBeVisible();
  40  |
  41  |     await expect(page.getByLabel('Sheet status')).toContainText(/Total rows:\s*3|3\s*\/\s*3/);
  42  |     await expect(page.getByRole('button', { name: /Terminal/i })).toBeVisible();
  43  |
  44  |     // Left filters panel summary
  45  |     await expect(page.getByText(/Column filters/i)).toBeVisible();
  46  |   });
  47  |
  48  |   test('Project menu New Project navigates to /project/new', async ({ page }) => {
  49  |     await page.getByRole('button', { name: /No Project|e2e|Project/i }).first().click();
  50  |     await page.getByRole('menuitem', { name: /New Project/i }).click();
  51  |     await expect(page).toHaveURL(/\/project\/new/);
  52  |   });
  53  |
  54  |   test('Home button returns to dashboard', async ({ page }) => {
  55  |     await page.getByRole('button', { name: /Home/i }).click();
  56  |     await expect(page).toHaveURL(/\/dashboard/);
  57  |   });
  58  |
  59  |   test('terminal toggle from footer', async ({ page }) => {
  60  |     const terminalBtn = page.getByRole('button', { name: /Terminal/i });
  61  |     await terminalBtn.click();
  62  |     // Terminal panel mounts in the bottom resizable region
  63  |     await expect(page.locator('[data-panel-id="terminal"], .xterm, [class*="terminal"]').first()).toBeVisible({
  64  |       timeout: 10_000,
  65  |     });
  66  |     await terminalBtn.click();
  67  |   });
  68  | });
  69  |
  70  | test.describe('Workspace stress — column header menu', () => {
  71  |   test.beforeEach(async ({ page }) => {
  72  |     await openDatasetWorkspace(page);
  73  |   });
  74  |
  75  |   test('sort ascending / descending from column menu', async ({ page }) => {
  76  |     await openColumnMenu(page, 'age');
  77  |     await page.getByRole('menuitem', { name: /Sort ascending/i }).click();
  78  |     // Menu closes; header still present
  79  |     await expect(sheetHeaderButton(page, 'age')).toBeVisible();
  80  |
  81  |     await openColumnMenu(page, 'age');
  82  |     await page.getByRole('menuitem', { name: /Sort descending/i }).click();
  83  |     await expect(sheetHeaderButton(page, 'age')).toBeVisible();
  84  |   });
  85  |
  86  |   test('hide column and show hidden columns', async ({ page }) => {
  87  |     await openColumnMenu(page, 'score');
  88  |     await page.getByRole('menuitem', { name: /Hide column/i }).click();
  89  |     await expect(sheetHeaderButton(page, 'score')).toHaveCount(0);
  90  |
  91  |     await openColumnMenu(page, 'age');
  92  |     await page.getByRole('menuitem', { name: /Show hidden columns/i }).click();
  93  |     await expect(sheetHeaderButton(page, 'score')).toBeVisible();
  94  |   });
  95  |
  96  |   test('Filter… reveals filter bar', async ({ page }) => {
  97  |     await openColumnMenu(page, 'age');
  98  |     await page.getByRole('menuitem', { name: /Filter/i }).click();
  99  |     // Inline filter bar uses Apply / Clear controls
  100 |     await expect(
  101 |       page.getByRole('button', { name: /Apply/i }).or(page.getByPlaceholder(/value/i)).first()
  102 |     ).toBeVisible({ timeout: 10_000 });
  103 |   });
  104 |
  105 |   test('copy column is available in menu', async ({ page }) => {
  106 |     await openColumnMenu(page, 'group');
  107 |     await expect(page.getByRole('menuitem', { name: /Copy column/i })).toBeVisible();
  108 |     await page.keyboard.press('Escape');
  109 |   });
  110 |
  111 |   test('heatmap toggle appears for numeric columns', async ({ page }) => {
  112 |     await openColumnMenu(page, 'score');
  113 |     await expect(page.getByRole('menuitemcheckbox', { name: /Show heatmap/i })).toBeVisible();
  114 |     await page.keyboard.press('Escape');
  115 |   });
  116 | });
  117 |
  118 | test.describe('Workspace stress — cells & clipboard', () => {
  119 |   test.beforeEach(async ({ page }) => {
```
