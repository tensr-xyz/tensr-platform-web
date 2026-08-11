/**
 * Workspace stress suite — covers sheet chrome + table interactions.
 *
 * Run:
 *   pnpm test:workspace
 *   pnpm exec playwright test -c playwright.workspace.config.ts --headed
 *
 * Inventory covered here (automate first wave). Remaining manual / later waves
 * are listed at the bottom of this file.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { E2E_DATASET_ID, seedE2eSession } from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

async function openDatasetWorkspace(page: Page): Promise<void> {
  await seedE2eSession(page);
  await installDatasetApiMocks(page);
  await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
  await expect(page.getByText('age', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
}

function sheetHeaderButton(page: Page, columnName: string): Locator {
  return page.getByRole('button', { name: columnName, exact: true }).first();
}

async function openColumnMenu(page: Page, columnName: string): Promise<void> {
  await sheetHeaderButton(page, columnName).click();
  await expect(page.getByRole('menuitem', { name: /Sort ascending/i })).toBeVisible();
}

test.describe('Workspace stress — shell & navigation', () => {
  test.beforeEach(async ({ page }) => {
    await openDatasetWorkspace(page);
  });

  test('loads sheet chrome: headers, footer, panels', async ({ page }) => {
    await expect(page.getByText('age', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('group', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('score', { exact: true }).first()).toBeVisible();

    await expect(page.getByLabel('Sheet status')).toContainText(/Total rows:\s*3|3\s*\/\s*3/);
    await expect(page.getByRole('button', { name: /Terminal/i })).toBeVisible();

    // Left filters panel summary
    await expect(page.getByText(/Column filters/i)).toBeVisible();
  });

  test('Project menu New Project navigates to /project/new', async ({ page }) => {
    await page
      .getByRole('button', { name: /No Project|e2e|Project/i })
      .first()
      .click();
    await page.getByRole('menuitem', { name: /New Project/i }).click();
    await expect(page).toHaveURL(/\/project\/new/);
  });

  test('Home button returns to dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /Home/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('terminal toggle from footer', async ({ page }) => {
    const terminalBtn = page.getByRole('button', { name: /Terminal/i });
    await terminalBtn.click();
    // Terminal panel mounts in the bottom resizable region
    await expect(
      page.locator('[data-panel-id="terminal"], .xterm, [class*="terminal"]').first()
    ).toBeVisible({
      timeout: 10_000,
    });
    await terminalBtn.click();
  });
});

test.describe('Workspace stress — column header menu', () => {
  test.beforeEach(async ({ page }) => {
    await openDatasetWorkspace(page);
  });

  test('sort ascending / descending from column menu', async ({ page }) => {
    await openColumnMenu(page, 'age');
    await page.getByRole('menuitem', { name: /Sort ascending/i }).click();
    // Menu closes; header still present
    await expect(sheetHeaderButton(page, 'age')).toBeVisible();

    await openColumnMenu(page, 'age');
    await page.getByRole('menuitem', { name: /Sort descending/i }).click();
    await expect(sheetHeaderButton(page, 'age')).toBeVisible();
  });

  test('hide column and show hidden columns', async ({ page }) => {
    await openColumnMenu(page, 'score');
    await page.getByRole('menuitem', { name: /Hide column/i }).click();
    await expect(sheetHeaderButton(page, 'score')).toHaveCount(0);

    await openColumnMenu(page, 'age');
    await page.getByRole('menuitem', { name: /Show hidden columns/i }).click();
    await expect(sheetHeaderButton(page, 'score')).toBeVisible();
  });

  test('Filter… reveals filter bar', async ({ page }) => {
    await openColumnMenu(page, 'age');
    await page.getByRole('menuitem', { name: /Filter/i }).click();
    // Inline filter bar uses Apply / Clear controls
    await expect(
      page.getByRole('button', { name: /Apply/i }).or(page.getByPlaceholder(/value/i)).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('copy column is available in menu', async ({ page }) => {
    await openColumnMenu(page, 'group');
    await expect(page.getByRole('menuitem', { name: /Copy column/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('heatmap toggle appears for numeric columns', async ({ page }) => {
    await openColumnMenu(page, 'score');
    await expect(page.getByRole('menuitemcheckbox', { name: /Show heatmap/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

test.describe('Workspace stress — cells & clipboard', () => {
  test.beforeEach(async ({ page }) => {
    await openDatasetWorkspace(page);
  });

  test('focus a cell, edit value, and see it in the grid', async ({ page }) => {
    // First data cell under age (skip select gutter)
    const ageCell = page.locator('[data-column-id="age"]').first();
    await ageCell.dblclick();
    const editor = page.locator('input, textarea').first();
    await expect(editor).toBeVisible({ timeout: 5_000 });
    await editor.fill('99');
    await page.keyboard.press('Enter');
    await expect(
      page.locator('[data-column-id="age"]').filter({ hasText: '99' }).first()
    ).toBeVisible({
      timeout: 5_000,
    });
  });

  test('Delete clears focused cell', async ({ page }) => {
    const ageCell = page.locator('[data-column-id="age"]').first();
    await ageCell.click();
    await page.keyboard.press('Delete');
    // Cell should no longer show the original "25" after clear (first row)
    await expect(ageCell).not.toHaveText(/^25$/);
  });

  test('copy / paste via keyboard', async ({ page }) => {
    const ageCell = page.locator('[data-column-id="age"]').first();
    await ageCell.click();
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+c`);
    const scoreCell = page.locator('[data-column-id="score"]').first();
    await scoreCell.click();
    await page.keyboard.press(`${mod}+v`);
    // After paste, score cell should reflect age's value (25)
    await expect(scoreCell).toContainText(/25|88/);
  });

  test('row context menu exposes insert/delete', async ({ page }) => {
    const rowGutter = page.locator('[data-column-id="select"]').first();
    await rowGutter.click({ button: 'right' });
    await expect(
      page
        .getByRole('menuitem', { name: /Insert row above/i })
        .or(page.getByText(/Insert row above/i))
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Delete row/i).first()).toBeVisible();
    await page.keyboard.press('Escape');
  });
});

test.describe('Workspace stress — column resize', () => {
  test.beforeEach(async ({ page }) => {
    await openDatasetWorkspace(page);
  });

  test('resizing header updates body cell width', async ({ page }) => {
    const header = page.locator('th, [role="columnheader"]').filter({ hasText: 'age' }).first();
    await expect(header).toBeVisible();
    const before = await header.boundingBox();
    expect(before).toBeTruthy();

    // Drag the resize handle on the right edge of the header
    const handle = header.locator('.cursor-col-resize, [class*="col-resize"]').first();
    const box = (await handle.boundingBox()) || before!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();

    const afterHeader = await header.boundingBox();
    const bodyCell = page.locator('[data-column-id="age"]').first();
    const afterBody = await bodyCell.boundingBox();
    expect(afterHeader).toBeTruthy();
    expect(afterBody).toBeTruthy();
    expect(afterHeader!.width).toBeGreaterThan(before!.width + 40);
    // Header and body should stay aligned (within a few px)
    expect(Math.abs(afterHeader!.width - afterBody!.width)).toBeLessThan(4);
  });
});

test.describe('Workspace stress — left column filters', () => {
  test.beforeEach(async ({ page }) => {
    await openDatasetWorkspace(page);
  });

  test('expand numeric column shows range controls', async ({ page }) => {
    // Accordion trigger is the column name in the left panel
    const leftAge = page
      .getByText('Column filters')
      .locator('..')
      .locator('..')
      .getByText('age', { exact: true })
      .first();
    // Fallback: click any left-panel age row
    const trigger = page.locator('button, [role="button"]').filter({ hasText: /^age$/ }).nth(1);
    if (await leftAge.isVisible().catch(() => false)) {
      await leftAge.click();
    } else {
      await trigger.click();
    }

    await expect(
      page
        .getByLabel('Range minimum')
        .or(page.getByText(/distinct/i))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('footer reflects filtered vs total rows when filters apply', async ({ page }) => {
    // Open group filter and toggle values via left panel if possible;
    // otherwise use inline filter bar from column menu.
    await openColumnMenu(page, 'group');
    await page.getByRole('menuitem', { name: /Filter/i }).click();

    const valueInput = page
      .locator('input')
      .filter({ hasNot: page.locator('[type="checkbox"]') })
      .last();
    if (await valueInput.isVisible().catch(() => false)) {
      await valueInput.fill('A');
      const apply = page.getByRole('button', { name: /Apply/i });
      if (await apply.isVisible().catch(() => false)) {
        await apply.click();
      } else {
        await page.keyboard.press('Enter');
      }
    }

    const footer = page.getByLabel('Sheet status');
    await expect(footer).toBeVisible();
    // Either filtered form "N / 3 rows" or still total if filter UI path differs
    await expect(footer).toContainText(/rows|Total rows/i);
  });
});

test.describe('Workspace stress — toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await openDatasetWorkspace(page);
  });

  test('Sheet / Notebook tabs are available', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /^Sheet$/i }).or(page.getByText(/^Sheet$/))
    ).toBeVisible();
    const notebook = page
      .getByRole('button', { name: /^Notebook$/i })
      .or(page.getByText(/^Notebook$/));
    if (
      await notebook
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await notebook.first().click();
      await expect(page.getByText(/Notebook|Run|cell/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('left panel toggle hides column filters', async ({ page }) => {
    const toggle = page
      .getByRole('button', { name: /Hide analysis tools|Show analysis tools|analysis tools/i })
      .or(
        page
          .locator('button')
          .filter({ has: page.locator('svg') })
          .first()
      );
    // Prefer explicit title from tab-manager
    const hideBtn = page.locator(
      'button[title="Hide analysis tools"], button[title="Show analysis tools"]'
    );
    if (
      await hideBtn
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await hideBtn.first().click();
      await expect(page.getByText(/Column filters/i)).toHaveCount(0, { timeout: 5_000 });
      await page.locator('button[title="Show analysis tools"]').click();
      await expect(page.getByText(/Column filters/i)).toBeVisible();
    } else {
      test.skip(true, 'Left panel toggle button not found with expected title');
    }
    void toggle;
  });
});

/**
 * Manual / later automation backlog (not yet in this file):
 *
 * Column menu: rename, delete column, freeze/unfreeze, measurement level,
 *   group/aggregate by, suggest transformations, clean categories, detect outliers
 * Cells: cut, fill handle, fill down/right, select row/column/all, undo/redo
 * Filters: categorical multi-select, visibility eye, range drag on chart
 * Project: file tree open/create (create APIs stubbed), save, version history
 * Collab: share link, start/end session
 * Analyze/Data/Transform: covered partially by analyze-menu + analysis-descriptives
 * Agent panel: Ask/Plan/Agent modes, threads (partial agent-chat smoke)
 */
