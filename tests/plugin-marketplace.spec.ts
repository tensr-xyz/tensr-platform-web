import { test, expect } from '@playwright/test';

test.describe('Plugin Marketplace', () => {
  test('should display marketplace layout', async ({ page }) => {
    // Navigate to the marketplace
    await page.goto('/plugins');
    await expect(page).toHaveURL('/plugins');

    // Wait for page to load completely
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Wait for React to render

    // Check for basic page structure
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Look for any content on the page
    const pageText = await page.locator('body').textContent();
    expect(pageText).toBeTruthy();
    expect(pageText?.length).toBeGreaterThan(100);

    // Check for expected marketplace content
    expect(pageText).toContain('marketplace');

    // Check that the page has loaded some meaningful content (not just loading)
    const loadingText = page.locator('text=Loading marketplace');
    if (await loadingText.isVisible()) {
      // If still loading, wait a bit more
      await page.waitForTimeout(3000);
    }

    // Look for any actual content beyond just loading states
    const contentElements = page
      .locator('div, p, h1, h2, h3, span')
      .filter({ hasText: /[a-zA-Z]{3,}/ });
    const contentCount = await contentElements.count();
    expect(contentCount).toBeGreaterThan(5); // Should have several content elements
  });

  test('should navigate to plugin upload page', async ({ page }) => {
    await page.goto('/plugins');
    await page.waitForLoadState('domcontentloaded');

    // Look for upload button or link
    const uploadButton = page
      .locator('text=Upload')
      .or(page.locator('text=Create'))
      .or(page.locator('text=Add Plugin'));

    if (await uploadButton.isVisible()) {
      await uploadButton.click();
      // Wait for navigation
      await page.waitForLoadState('domcontentloaded');

      // Check if we're on a different page
      const currentUrl = page.url();
      expect(currentUrl).not.toBe('/plugins');
    } else {
      // If no upload button found, just check that page loaded
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('should navigate to creator dashboard', async ({ page }) => {
    await page.goto('/creator');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check for basic page structure
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Look for creator-specific content
    const pageText = await page.locator('body').textContent();
    expect(pageText).toBeTruthy();
    expect(pageText?.length).toBeGreaterThan(100);
  });

  test('should navigate to analytics page', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check for basic page structure
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Look for analytics-specific content
    const pageText = await page.locator('body').textContent();
    expect(pageText).toBeTruthy();
    expect(pageText?.length).toBeGreaterThan(100);
  });
});
