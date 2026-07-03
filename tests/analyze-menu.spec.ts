import { test, expect } from '@playwright/test';
import {
  analysisPalette,
  E2E_DATASET_ID,
  openAnalysisPalette,
  selectPaletteTab,
  dismissDialogs,
  seedE2eSession,
} from './fixtures/e2e-auth';
import { installDatasetApiMocks } from './fixtures/api-mocks';

/** Production Analyze + Data menu labels (must match production-menu.tsx). */
const DATA_MENU_LABELS = [
  'Import Data',
  'Export Data',
  'Merge Datasets',
  'Handle Missing Data',
  'Find Duplicates',
];

const ANALYZE_MENU_LABELS = [
  'Descriptives',
  'Independent-Samples T Test',
  'Paired-Samples T Test',
  'One-Sample T Test',
  'One-Way ANOVA',
  'Mann-Whitney U',
  'Kruskal-Wallis H',
  'Bivariate Correlations',
  'Linear Regression',
  'Binary Logistic Regression',
  'Crosstabs',
  'Wilcoxon Signed-Rank',
  'Friedman Test',
  'Kolmogorov-Smirnov',
  'Reliability Analysis',
  'Partial Correlation',
  'Principal Component Analysis',
  'Exploratory Factor Analysis',
  'Two-Way ANOVA',
  'Repeated Measures ANOVA',
  'Multivariate ANOVA',
  'ANCOVA',
  'Discriminant Analysis',
  'Cluster Analysis',
  'Decision Tree Classification',
  'Poisson Regression',
  "Cohen's Kappa",
];

const TRANSFORM_MENU_LABELS = [
  'Compute Variable',
  'Count Values',
  'Shift Values',
  'Recode Variables',
  'Standardize Variables',
  'Visual Binning',
  'Lag Cases',
  'Lead Cases',
];

const UNAVAILABLE_COPY = 'on the launch roadmap';

const COMING_SOON_TAB_LABELS = [
  'Charts (coming soon)',
  'Time series (coming soon)',
  'ML & AI (coming soon)',
];

test.describe('Analyze command palette', () => {
  test.beforeEach(async ({ page }) => {
    await seedE2eSession(page);
    await installDatasetApiMocks(page);
    await page.goto(`/workspace/dataset/${E2E_DATASET_ID}?name=e2e-sample.csv`);
    await expect(page.getByText('age', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  });

  test('lists only production analysis items and none open the unavailable dialog', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await openAnalysisPalette(page);
    const palette = analysisPalette(page);

    await selectPaletteTab(page, 'Data');
    for (const label of DATA_MENU_LABELS) {
      await expect(palette.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    await selectPaletteTab(page, 'Analyze');
    for (const label of ANALYZE_MENU_LABELS) {
      await expect(palette.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    await selectPaletteTab(page, 'Transform');
    for (const label of TRANSFORM_MENU_LABELS) {
      await expect(palette.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    for (const tabLabel of COMING_SOON_TAB_LABELS) {
      await expect(palette.getByText(tabLabel, { exact: true })).toBeVisible();
      await expect(palette.getByRole('tab', { name: tabLabel, exact: true })).toHaveCount(0);
    }

    const allLabels = [...DATA_MENU_LABELS, ...ANALYZE_MENU_LABELS, ...TRANSFORM_MENU_LABELS];

    for (const label of allLabels) {
      await dismissDialogs(page);
      await openAnalysisPalette(page);
      const currentPalette = analysisPalette(page);
      const tab = DATA_MENU_LABELS.includes(label)
        ? 'Data'
        : TRANSFORM_MENU_LABELS.includes(label)
          ? 'Transform'
          : 'Analyze';
      await selectPaletteTab(page, tab);
      await currentPalette.getByRole('button', { name: label, exact: true }).click();

      await expect(page.getByText(UNAVAILABLE_COPY)).toHaveCount(0);

      const setupDialog = page
        .getByRole('dialog')
        .filter({ has: page.getByRole('button', { name: 'Run analysis' }) });
      if (await setupDialog.isVisible().catch(() => false)) {
        await dismissDialogs(page);
        continue;
      }

      await dismissDialogs(page);
    }
  });
});
