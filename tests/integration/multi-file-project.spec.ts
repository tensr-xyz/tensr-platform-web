import { test, expect } from '@playwright/test';

test.describe('Multi-File Project Processing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the project page
    await page.goto('/workspace/project/test-project-id');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should show file selector when project has multiple files', async ({ page }) => {
    // Mock the API responses
    await page.route('**/api/projects/test-project-id', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-project-id',
          name: 'Multi-File Project',
          files: [
            { path: 'data1.csv', type: 'text/csv', size: 1024 },
            { path: 'data2.csv', type: 'text/csv', size: 2048 },
            {
              path: 'analysis.xlsx',
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              size: 5120,
            },
          ],
          extractedPath: 'projects/test-project-id/',
          userId: 'test-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Click the import button
    await page.click('[data-testid="import-data-button"]');

    // Wait for file selector to appear
    await expect(page.locator('[data-testid="dialog"]')).toBeVisible();

    // Check that all files are displayed
    await expect(page.locator('text=data1.csv')).toBeVisible();
    await expect(page.locator('text=data2.csv')).toBeVisible();
    await expect(page.locator('text=analysis.xlsx')).toBeVisible();

    // Check file sizes are displayed
    await expect(page.locator('text=1.0 KB')).toBeVisible();
    await expect(page.locator('text=2.0 KB')).toBeVisible();
    await expect(page.locator('text=5.0 KB')).toBeVisible();
  });

  test('should process selected file when user selects a file', async ({ page }) => {
    // Mock the project details API
    await page.route('**/api/projects/test-project-id', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-project-id',
          name: 'Multi-File Project',
          files: [
            { path: 'data1.csv', type: 'text/csv', size: 1024 },
            { path: 'data2.csv', type: 'text/csv', size: 2048 },
          ],
          extractedPath: 'projects/test-project-id/',
          userId: 'test-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Mock the download URL API for the second file
    await page.route('**/api/projects/test-project-id/download-url?fileIndex=1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          downloadUrl: 'https://s3.amazonaws.com/bucket/data2.csv',
          fileName: 'data2.csv',
          fileType: 'text/csv',
          fileSize: 2048,
          fileIndex: 1,
          totalFiles: 2,
        }),
      });
    });

    // Mock the Rust API processing
    await page.route('**/api/projects/test-project-id/process', async route => {
      const requestBody = await route.request().postDataJSON();
      expect(requestBody.file_index).toBe(1);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metadata: {
            rows: 100,
            columns: 5,
            preview: [
              ['Name', 'Age', 'City', 'Salary', 'Department'],
              ['John Doe', '30', 'New York', '50000', 'Engineering'],
              ['Jane Smith', '25', 'San Francisco', '60000', 'Marketing'],
            ],
            column_names: ['Name', 'Age', 'City', 'Salary', 'Department'],
          },
          column_summaries: {
            Name: { type: 'string', unique_count: 100 },
            Age: { type: 'number', min: 22, max: 65, mean: 35.5 },
            City: { type: 'string', unique_count: 15 },
            Salary: { type: 'number', min: 30000, max: 120000, mean: 55000 },
            Department: { type: 'string', unique_count: 8 },
          },
        }),
      });
    });

    // Click import button
    await page.click('[data-testid="import-data-button"]');

    // Wait for file selector
    await expect(page.locator('[data-testid="dialog"]')).toBeVisible();

    // Select the second file
    await page.click('text=data2.csv');

    // Wait for import wizard to appear
    await expect(page.locator('[data-testid="import-wizard"]')).toBeVisible();

    // Check that the correct data is displayed
    await expect(page.locator('text=100 rows')).toBeVisible();
    await expect(page.locator('text=5 columns')).toBeVisible();
  });

  test('should handle single file project without showing file selector', async ({ page }) => {
    // Mock the API responses for single file project
    await page.route('**/api/projects/test-project-id', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-project-id',
          name: 'Single File Project',
          files: [{ path: 'data.csv', type: 'text/csv', size: 1024 }],
          extractedPath: 'projects/test-project-id/',
          userId: 'test-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Mock the processing API
    await page.route('**/api/projects/test-project-id/process', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metadata: {
            rows: 50,
            columns: 3,
            preview: [
              ['ID', 'Name', 'Value'],
              ['1', 'Item 1', '100'],
              ['2', 'Item 2', '200'],
            ],
            column_names: ['ID', 'Name', 'Value'],
          },
          column_summaries: {
            ID: { type: 'number', unique_count: 50 },
            Name: { type: 'string', unique_count: 50 },
            Value: { type: 'number', min: 10, max: 1000, mean: 500 },
          },
        }),
      });
    });

    // Click import button
    await page.click('[data-testid="import-data-button"]');

    // Should go directly to import wizard, not file selector
    await expect(page.locator('[data-testid="import-wizard"]')).toBeVisible();
    await expect(page.locator('[data-testid="dialog"]')).not.toBeVisible();
  });

  test('should handle empty project gracefully', async ({ page }) => {
    // Mock the API responses for empty project
    await page.route('**/api/projects/test-project-id', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-project-id',
          name: 'Empty Project',
          files: [],
          extractedPath: 'projects/test-project-id/',
          userId: 'test-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Click import button
    await page.click('[data-testid="import-data-button"]');

    // Should show error message
    await expect(page.locator('text=No files available')).toBeVisible();
  });

  test('should allow canceling file selection', async ({ page }) => {
    // Mock the API responses
    await page.route('**/api/projects/test-project-id', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-project-id',
          name: 'Multi-File Project',
          files: [
            { path: 'data1.csv', type: 'text/csv', size: 1024 },
            { path: 'data2.csv', type: 'text/csv', size: 2048 },
          ],
          extractedPath: 'projects/test-project-id/',
          userId: 'test-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Click import button
    await page.click('[data-testid="import-data-button"]');

    // Wait for file selector
    await expect(page.locator('[data-testid="dialog"]')).toBeVisible();

    // Click cancel
    await page.click('text=Cancel');

    // File selector should be closed
    await expect(page.locator('[data-testid="dialog"]')).not.toBeVisible();

    // Import wizard should not appear
    await expect(page.locator('[data-testid="import-wizard"]')).not.toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/projects/test-project-id', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Internal server error',
        }),
      });
    });

    // Click import button
    await page.click('[data-testid="import-data-button"]');

    // Should show error message
    await expect(page.locator('text=Failed to load project details')).toBeVisible();
  });

  test('should handle large file projects', async ({ page }) => {
    // Create a project with many files
    const manyFiles = Array.from({ length: 50 }, (_, i) => ({
      path: `file_${i}.csv`,
      type: 'text/csv',
      size: 1024 * (i + 1),
    }));

    await page.route('**/api/projects/test-project-id', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-project-id',
          name: 'Large Project',
          files: manyFiles,
          extractedPath: 'projects/test-project-id/',
          userId: 'test-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    // Click import button
    await page.click('[data-testid="import-data-button"]');

    // Wait for file selector
    await expect(page.locator('[data-testid="dialog"]')).toBeVisible();

    // Check that files are displayed (may be paginated or virtualized)
    await expect(page.locator('text=file_0.csv')).toBeVisible();
    await expect(page.locator('text=file_49.csv')).toBeVisible();

    // Select a file from the middle
    await page.click('text=file_25.csv');

    // Should process the selected file
    await expect(page.locator('[data-testid="import-wizard"]')).toBeVisible();
  });
});
